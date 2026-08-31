"""NotifyService：Server酱 webhook 告警（G7/B3——资金类告警唯一通道）。

设计依据：backend-detail-design.md §4.16。
失败仅记日志：不重试、不阻塞业务——告警通道自身不得成为资金链路依赖。
零内存状态：无去重缓存，调用方以状态转移驱动（转移只发生一次）。
"""
from __future__ import annotations

import http.client
import logging
import re
import urllib.parse

logger = logging.getLogger("app.notify")

# 固定告警出口：目标主机为编译期字面量常量（非运行时构造），
# 仅路径中的 send_key 来自服务端环境配置且经白名单校验——不存在用户可控目标。
SERVERCHAN_HOST = "sctapi.ftqq.com"
_SEND_KEY_RE = re.compile(r"^[A-Za-z0-9]{8,64}$")


class NotifyService:
    """Server酱告警发送器（SERVERCHAN_SENDKEY 未配置时降级为日志）。"""

    def __init__(self, send_key: str = "", timeout_seconds: float = 5.0):
        self._send_key = send_key if _SEND_KEY_RE.fullmatch(send_key or "") else ""
        self._timeout = timeout_seconds

    def send(self, title: str, markdown: str = "") -> bool:
        """发送一条告警。返回是否成功投递（测试断言用；业务方不依赖返回值）。"""
        if not self._send_key:
            logger.warning("event=notify.skipped key=unset title=%s", title)
            return False

        path = "/" + self._send_key + ".send"
        body = urllib.parse.urlencode({"title": title, "desp": markdown})
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        try:
            conn = http.client.HTTPSConnection(SERVERCHAN_HOST, timeout=self._timeout)
            try:
                conn.request("POST", path, body=body, headers=headers)
                resp = conn.getresponse()
                ok = resp.status == 200
                if not ok:
                    logger.warning("event=notify.fail http=%s title=%s", resp.status, title)
                return ok
            finally:
                conn.close()
        except Exception as e:  # noqa: BLE001
            # 告警通道永不向上抛
            logger.warning("event=notify.fail error=%s title=%s", e, title)
            return False


class LoggingNotifyService:
    """测试替身：记录调用供断言（零副作用、零网络）。"""

    def __init__(self):
        self.sent: list[dict] = []

    def send(self, title: str, markdown: str = "") -> bool:
        self.sent.append({"title": title, "markdown": markdown})
        return True
