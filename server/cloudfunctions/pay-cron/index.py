"""pay-cron 云函数：定时触发器薄壳——POST 到 S端 4 个 /api/cron/* 扫描端点。

设计依据：backend-detail-design.md §5.3 R1-R4。
安全声明（SSRF 加固）：TARGET_BASE 为部署期环境变量；发请求前强制
https 协议 + 解析目标主机全部 IP 并阻断私网/环回/链路本地地址 + 禁重定向；
路径仅从本函数白名单映射表选取，无外部输入参与构造。

环境变量：
    TARGET_BASE  S端服务公网基址（https://host[:port]/前缀）
    CRON_TOKEN   与 S端 settings.CRON_TOKEN 一致（X-Cron-Token 头）

触发器（部署时经 MCP manageFunctions createFunctionTrigger 注册；SCF timer cron 为
北京时区；频率沿革：09-02 由 2 分钟级降为 10 分钟级，09-04 再降为小时级——10 分钟
一次请求会把缩零窗口永远封死（MinNum=0 形同虚设，实例常驻吃资源点，09-04 排查
云托管占总消耗 99.2%）；现最大无流量空窗 47 分钟（13 分→下一整点）争取深夜缩零，
白天真实用户访问间隔约 30 分钟本身就会保活实例，冷启动由本函数 55s 超时+扫描幂等
兜底；create_order/get_pending 已自带过期防死码判断，关单延迟不影响 UX）：
    r1-scan-orders      0 0 * * * * *     → POST /api/cron/scan-orders（T1 关单+R1 退款提交）
    r2-scan-repairs     0 7 * * * * *     → POST /api/cron/scan-repairs
    r3-scan-refunds     0 13 * * * * *    → POST /api/cron/scan-refunds
    r4-daily-reconcile  0 30 10 * * * *   → POST /api/cron/daily-reconcile（北京 10:30：
                          微信账单 10 点后才生成，设计稿的 07:00 会天天报账单未就绪）
"""
import http.client
import ipaddress
import json
import os
import socket
import urllib.parse

TARGET_BASE = os.getenv("TARGET_BASE", "").rstrip("/")
CRON_TOKEN = os.getenv("CRON_TOKEN", "")

# 触发器名 → 服务端路径白名单（唯一取值来源，无外部输入参与构造）
PATHS = {
    "r1-scan-orders": "/api/cron/scan-orders",
    "r2-scan-repairs": "/api/cron/scan-repairs",
    "r3-scan-refunds": "/api/cron/scan-refunds",
    "r4-daily-reconcile": "/api/cron/daily-reconcile",
}


def _resolve_guarded(host: str) -> None:
    """解析主机全部地址，命中私网/环回/链路本地/保留段即拒绝（防内网探测与 DNS rebinding）。"""
    for info in socket.getaddrinfo(host, None):
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private or ip.is_loopback or ip.is_link_local
            or ip.is_reserved or ip.is_multicast or ip.is_unspecified
        ):
            raise ValueError(f"blocked non-public address: {ip}")


def _post(path: str) -> tuple[int, str]:
    """向 TARGET_BASE（https）白名单路径发 POST。返回 (status, body)。"""
    parts = urllib.parse.urlsplit(TARGET_BASE)
    if parts.scheme != "https" or not parts.hostname:
        raise ValueError("TARGET_BASE must be https://host[/prefix]")
    _resolve_guarded(parts.hostname)
    port = parts.port or 443
    full_path = (parts.path or "").rstrip("/") + path
    conn = http.client.HTTPSConnection(parts.hostname, port=port, timeout=55)
    try:
        conn.request(
            "POST", full_path, body="",
            headers={"X-Cron-Token": CRON_TOKEN, "Content-Type": "application/x-www-form-urlencoded"},
        )
        resp = conn.getresponse()
        return resp.status, resp.read().decode()
    finally:
        conn.close()


def main_handler(event, context):
    raw = event.get("TriggerName") or event.get("triggerName") or ""
    trigger_name = str(raw)
    path = PATHS.get(trigger_name)
    if not path:
        # 手工调用兜底：允许 event.action 指定白名单内的动作
        path = PATHS.get(event.get("action") or "")

    if not path:
        return {"statusCode": 400, "body": json.dumps({"code": 1, "msg": "unknown trigger"})}
    if not TARGET_BASE:
        return {"statusCode": 500, "body": json.dumps({"code": 1, "msg": "TARGET_BASE unset"})}

    try:
        status, body = _post(path)
        print(f"event=pay_cron trigger={trigger_name} path={path} status={status}")
        return {"statusCode": status, "body": body}
    except Exception as e:  # noqa: BLE001——失败落日志，下轮触发自然重试（扫描幂等）
        print(f"event=pay_cron_fail trigger={trigger_name} path={path} error={e}")
        return {"statusCode": 502, "body": json.dumps({"code": -1, "msg": str(e)})}


# SCF Handler 兼容别名：控制台/MCP 配置若为 index.main 也能命中（曾因 handler=index.main
# 而函数名只有 main_handler 致 09-02 17:17 起全部定时触发 handler not found）
main = main_handler
