"""CloudBase PG HTTP API（PostgREST）客户端。

用环境 API Key 鉴权（role=service_role，绕过 RLS），通过
https://<envId>.api.tcloudbasegateway.com/v1/rdb/rest/<table> 做单表 CRUD。
本服务查询均为单表简单过滤/排序，PostgREST 语义完全覆盖。
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

# 显式 PostgREST 操作符前缀：filter 值以此开头时原样透传，纯值才补 eq.
_OPERATORS = ("eq.", "neq.", "gt.", "gte.", "lt.", "lte.", "in.", "is.", "or.", "not.", "textSearch.")


def to_iso(value: datetime | None) -> str | None:
    """datetime → ISO 8601 字符串（PostgREST 存储/返回格式）。"""
    return value.isoformat() if value is not None else None


def jsonable(doc: dict) -> dict:
    """文档值 JSON 兼容化：datetime/date → ISO 字符串（httpx json= 不认 datetime）。"""
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif hasattr(v, "isoformat") and not isinstance(v, (str, bytes)):
            out[k] = v.isoformat()  # date 等同形对象
        else:
            out[k] = v
    return out


def parse_dt(value: Any) -> datetime | None:
    """ISO 字符串 → datetime；空值/已是 datetime 原样处理。"""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


class PgRestClient:
    def __init__(
        self,
        endpoint: str,
        api_key: str,
        timeout: float = 10.0,
        transport: httpx.BaseTransport | None = None,
    ):
        self._endpoint = endpoint.rstrip("/")
        self._client = httpx.Client(
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
            transport=transport,  # 测试注入 MockTransport
        )

    def _raise(self, resp: httpx.Response) -> None:
        """raise_for_status 增强：异常消息带上网关错误码与消息（2026-08-31 复盘改进）。

        网关 4xx/5xx 的响应体（如 DATABASE_22P02 invalid input syntax）以前被
        raise_for_status 丢弃，排障只能绕过服务直连网关复现；现在随异常透出，
        日志里即可见真实错误。
        """
        if resp.is_success:
            return
        try:
            body = resp.json()
        except ValueError:
            body = None
        detail = ""
        if isinstance(body, dict) and (body.get("code") or body.get("message")):
            detail = f" | body={body.get('code', '')}: {body.get('message', '')}"
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise httpx.HTTPStatusError(
                f"{exc}{detail}", request=exc.request, response=exc.response
            ) from exc

    def find(
        self,
        table: str,
        filter: dict | None = None,
        sort: list[tuple[str, str]] | None = None,
        limit: int | None = None,
        select: str | None = None,
    ) -> list[dict]:
        params = self._build_params(filter, sort, limit)
        if select:
            params["select"] = select
        resp = self._client.get(
            f"{self._endpoint}/{table}",
            params=params,
        )
        self._raise(resp)
        return resp.json()

    def find_one(
        self,
        table: str,
        filter: dict | None = None,
        sort: list[tuple[str, str]] | None = None,
    ) -> dict | None:
        rows = self.find(table, filter, sort, limit=1)
        return rows[0] if rows else None

    def insert(self, table: str, doc: dict) -> None:
        # None → JSON null：PostgREST 省略字段会应用列 DEFAULT（如 ''），
        # 显式 null 才能写 NULL。需要数据库默认值的列（如 created_at）由调用方不传键。
        resp = self._client.post(f"{self._endpoint}/{table}", json=jsonable(doc))
        self._raise(resp)

    def update(self, table: str, filter: dict, changes: dict) -> None:
        body = jsonable({k: v for k, v in changes.items() if v is not None})
        resp = self._client.patch(
            f"{self._endpoint}/{table}",
            params=self._build_params(filter),
            json=body,
        )
        self._raise(resp)

    def update_cas(self, table: str, filter: dict, changes: dict) -> int:
        """条件更新并返回受影响行数（account-deletion 的 CAS 基元，design A1 方案②）。

        与 update 的差别：① changes 允许 None（显式写 NULL，如清空 deadline）；
        ② Prefer: return=representation 使响应携带被更新的行，len() 即真实行数——
        0 行=条件不满足（状态已被并发方改走），调用方据此实现幂等分支。
        """
        body = dict(changes)
        resp = self._client.patch(
            f"{self._endpoint}/{table}",
            params=self._build_params(filter),
            json=body,
            headers={"Prefer": "return=representation"},
        )
        self._raise(resp)
        return len(resp.json()) if resp.content else 0

    def delete(self, table: str, filter: dict) -> int:
        """删除并返回受影响行数（Prefer: return=representation 让响应携带删除的行）。"""
        resp = self._client.request(
            "DELETE",
            f"{self._endpoint}/{table}",
            params=self._build_params(filter),
            headers={"Prefer": "return=representation"},
        )
        self._raise(resp)
        return len(resp.json()) if resp.content else 0

    def commit(self) -> None:
        """PostgREST 每次请求即时生效，无事务；接口层统一调用，no-op。"""
        return

    # ══ schema 探测（pg_schema 自检 / pg_gate 门禁共用，design D1）══

    @staticmethod
    def _error_code(resp: httpx.Response) -> str:
        """提取网关/PostgREST 错误码（响应体 JSON 的 code 字段，如 DATABASE_22P02）。"""
        try:
            body = resp.json()
        except ValueError:
            return ""
        return str(body.get("code", "")) if isinstance(body, dict) else ""

    def probe_columns(self, table: str, cols: list[str]) -> tuple[int, str, list[str]]:
        """存在性探测：GET /{table}?select=<cols>&limit=1。

        与 find() 相反，不 raise（网络异常 TransportError 仍向上抛，由调用方降级）。
        返回 (http_status, pg_error_code, missing_cols)：
        - 200 = 全部列存在，missing_cols=[]
        - 404 = 表缺失（missing_cols=全部列名）
        - 400 = 逐列复探定位缺失列（missing_cols 为 `表.列` 形态）
        """
        resp = self._client.get(
            f"{self._endpoint}/{table}",
            params={"select": ",".join(cols), "limit": "1"},
        )
        code = self._error_code(resp)
        if resp.status_code == 404:
            return resp.status_code, code, [f"{table}.{c}" for c in cols]
        if resp.status_code == 400:
            missing = []
            for col in cols:
                r = self._client.get(
                    f"{self._endpoint}/{table}", params={"select": col, "limit": "1"},
                )
                if r.status_code != 200:
                    missing.append(f"{table}.{col}")
            return resp.status_code, code, missing
        return resp.status_code, code, []

    def probe_type(self, table: str, col: str, sentinel: str) -> tuple[int, str]:
        """文本列类型探测：GET /{table}?select=<col>&<col>=eq.<sentinel>&limit=1。

        200 = 列存在且接受文本值（文本族）；400+22P02 = 列存在但类型不符；
        400+PGRST204/42703 = 缺列。返回 (http_status, pg_error_code)。
        """
        resp = self._client.get(
            f"{self._endpoint}/{table}",
            params={"select": col, col: f"eq.{sentinel}", "limit": "1"},
        )
        return resp.status_code, self._error_code(resp)

    @staticmethod
    def _build_params(
        filter: dict | None,
        sort: list[tuple[str, str]] | None = None,
        limit: int | None = None,
    ) -> dict[str, str]:
        params: dict[str, str] = {}
        for key, value in (filter or {}).items():
            if value is None:
                params[key] = "is.null"
            elif isinstance(value, str) and value.startswith(_OPERATORS):
                # 显式 PostgREST 操作符（in.(...)、gte.<ts> 等）原样透传；
                # 纯值才补 eq. 前缀——否则 eq.in.(...) 是 400 语法错误
                params[key] = value
            else:
                params[key] = f"eq.{value}"
        if sort:
            params["order"] = ",".join(f"{field}.{direction}" for field, direction in sort)
        if limit is not None:
            params["limit"] = str(limit)
        return params
