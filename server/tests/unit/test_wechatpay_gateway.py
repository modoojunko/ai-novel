"""WechatPayGateway 契约测试（s-pay-wechat-gateway 任务 2.1-2.3）。

策略：真构造 WeChatPay SDK client（公钥模式，测试内生成 RSA 密钥对），
mock 掉 requests 传输层并豁免应答验签——请求参数构造与响应解析归一
全部走真实代码路径，仅隔离微信服务端。

覆盖：下单（time_expire/notify_url/金额分）、拒单与网络异常、查单五态
（含 REFUND 显式归一）、关单先查单+ORDERPAID+幂等、退款错误分类
（retryable/manual）、退款回调 notify_url 开关、账单双张下载解析
（元转分/反引号/汇总行截停）与 SHA1 校验。
"""
from __future__ import annotations

import gzip
import hashlib
import json

import pytest
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.infrastructure.payments.gateway import (
    CloseResult,
    PaymentStatus,
    RefundStatus,
)
from app.infrastructure.payments.wechatpay import (
    WechatPayGateway,
    _fen_from_yuan,
    _parse_bill_csv,
)

NOTIFY_URL = "https://www.example.com/api/pay/notify"


def _gen_pem_pair() -> tuple[str, str]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption()).decode()
    pub = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return priv, pub


def _resp(status: int, body, content_type: str = "application/json"):
    r = requests.models.Response()
    r.status_code = status
    r._content = body.encode("UTF-8") if isinstance(body, str) else body
    r.headers["Content-Type"] = content_type
    return r


@pytest.fixture
def gw(monkeypatch) -> WechatPayGateway:
    """真 SDK client（公钥模式）+ 传输层 mock + 应答验签豁免。"""
    from wechatpayv3 import WeChatPay, WeChatPayType
    from wechatpayv3.core import Core

    priv, pub = _gen_pem_pair()
    client = WeChatPay(
        wechatpay_type=WeChatPayType.NATIVE,
        mchid="1749993584", private_key=priv, cert_serial_no="A" * 40,
        appid="wx41899938fa14c26d", apiv3_key="k" * 32,
        public_key=pub, public_key_id="PUB_KEY_ID_TEST",
        timeout=(1, 2),
    )
    monkeypatch.setattr(Core, "_verify_signature", lambda self, h, b: True)
    return WechatPayGateway(client, notify_url=NOTIFY_URL)


def _capture(monkeypatch, gets=None, posts=None):
    """拦截 requests.get/post：记录 (url, kwargs)，按序返回预设响应。"""

    def fake_get(url=None, **kwargs):
        if gets is not None:
            gets.append((url, kwargs))
        return responses_get.pop(0)

    def fake_post(url=None, **kwargs):
        if posts is not None:
            posts.append((url, kwargs))
        return responses_post.pop(0)

    import wechatpayv3.core as core_mod
    monkeypatch.setattr(core_mod.requests, "get", fake_get)
    monkeypatch.setattr(core_mod.requests, "post", fake_post)


responses_get: list = []
responses_post: list = []


# ════════════ 下单（任务 2.1）════════════

class TestCreatePayment:

    def test_success_carries_expire_and_notify(self, gw, monkeypatch):
        posts: list = []
        _capture(monkeypatch, posts=posts)
        responses_post.append(_resp(200, json.dumps({"code_url": "weixin://wxpay/bizpayurl?sr=abc"})))
        result = gw.create_payment("O-1", 1, "测试商品", "attach-x", notify_url="")
        assert result.success and result.code_url == "weixin://wxpay/bizpayurl?sr=abc"
        body = posts[0][1]["json"]
        # time_expire 与本地 15 分钟 TTL 对齐（RFC3339 带时区）
        assert "time_expire" in body and body["time_expire"].endswith("+08:00")
        # notify_url 入参为空时回落网关注入的生产回调地址
        assert body["notify_url"] == NOTIFY_URL
        assert body["amount"] == {"total": 1, "currency": "CNY"}
        assert body["out_trade_no"] == "O-1"
        assert body["attach"] == "attach-x"

    def test_rejected_maps_to_prepay_failed(self, gw, monkeypatch):
        _capture(monkeypatch)
        responses_post.append(_resp(403, json.dumps({"code": "NO_AUTH", "message": "无权限"})))
        result = gw.create_payment("O-1", 1, "d", "", notify_url="")
        assert not result.success and result.error_kind == "prepay_failed"

    def test_network_error_maps_to_timeout(self, gw, monkeypatch):
        _capture(monkeypatch)
        import wechatpayv3.core as core_mod

        def boom(**kwargs):
            raise requests.exceptions.ConnectionError("down")

        monkeypatch.setattr(core_mod.requests, "post", boom)
        result = gw.create_payment("O-1", 1, "d", "", notify_url="")
        assert not result.success and result.error_kind == "timeout"


# ════════════ 查单（任务 2.1：REFUND 显式归一）════════════

class TestQueryPayment:

    def _query(self, gw, monkeypatch, body: str):
        _capture(monkeypatch)
        responses_get.append(_resp(200, body))
        return gw.query_payment("O-1")

    def test_success_state(self, gw, monkeypatch):
        r = self._query(gw, monkeypatch, json.dumps({
            "trade_state": "SUCCESS", "transaction_id": "50001",
            "payer": {"openid": "oX"}}))
        assert r.status == PaymentStatus.SUCCESS
        assert r.transaction_id == "50001" and r.payer_openid == "oX"

    def test_refund_state_explicit(self, gw, monkeypatch):
        """trade_state=REFUND（转入退款）显式归一，不落 UNKNOWN。"""
        r = self._query(gw, monkeypatch, json.dumps({"trade_state": "REFUND"}))
        assert r.status == PaymentStatus.REFUND

    def test_notpay_and_exotic_states(self, gw, monkeypatch):
        assert self._query(gw, monkeypatch, json.dumps({"trade_state": "NOTPAY"})).status == PaymentStatus.NOTPAY
        # USERPAYING 属刷卡支付场景，Native 不会出现 → UNKNOWN 兜底
        assert self._query(gw, monkeypatch, json.dumps({"trade_state": "USERPAYING"})).status == PaymentStatus.UNKNOWN

    def test_not_exist_maps_unknown(self, gw, monkeypatch):
        _capture(monkeypatch)
        responses_get.append(_resp(404, json.dumps({"code": "ORDER_NOT_EXIST", "message": "订单不存在"})))
        assert gw.query_payment("O-404").status == PaymentStatus.UNKNOWN


# ════════════ 关单（任务 2.1：先查单+ORDERPAID+幂等）════════════

class TestClosePayment:

    def test_already_paid_short_circuits(self, gw, monkeypatch):
        """查单已 SUCCESS → 不调关单接口，直接 already_paid。"""
        _capture(monkeypatch)
        responses_get.append(_resp(200, json.dumps({"trade_state": "SUCCESS"})))
        result = gw.close_payment("O-1")
        assert result == CloseResult(success=False, already_paid=True)
        assert responses_post == []  # 关单接口未被调用

    def test_close_ok(self, gw, monkeypatch):
        _capture(monkeypatch)
        responses_get.append(_resp(200, json.dumps({"trade_state": "NOTPAY"})))
        responses_post.append(_resp(204, ""))
        assert gw.close_payment("O-1").success is True

    def test_close_orderpaid(self, gw, monkeypatch):
        """403 ORDERPAID（官方：当作已支付的正常交易）→ already_paid。"""
        _capture(monkeypatch)
        responses_get.append(_resp(200, json.dumps({"trade_state": "NOTPAY"})))
        responses_post.append(_resp(403, json.dumps({"code": "ORDERPAID", "message": "订单已支付"})))
        assert gw.close_payment("O-1").already_paid is True

    def test_close_already_closed_idempotent(self, gw, monkeypatch):
        """已关闭再关单 = 幂等成功，不告警。"""
        _capture(monkeypatch)
        responses_get.append(_resp(200, json.dumps({"trade_state": "NOTPAY"})))
        responses_post.append(_resp(403, json.dumps({"code": "ORDERCLOSED", "message": "已关闭"})))
        assert gw.close_payment("O-1").success is True

    def test_close_system_error(self, gw, monkeypatch):
        _capture(monkeypatch)
        responses_get.append(_resp(200, json.dumps({"trade_state": "NOTPAY"})))
        responses_post.append(_resp(500, json.dumps({"code": "SYSTEMERROR", "message": "系统错误"})))
        result = gw.close_payment("O-1")
        assert result.success is False and result.already_paid is False


# ════════════ 退款（任务 2.2：错误分类 + notify_url 开关）════════════

class TestCreateRefund:

    def _reject(self, gw, monkeypatch, status, wx_code):
        posts: list = []
        _capture(monkeypatch, posts=posts)
        responses_post.append(_resp(status, json.dumps({"code": wx_code, "message": "x"})))
        return gw.create_refund("O-1", "O-1", 1, 1, "退款", notify_url=""), posts

    def test_acceptance_processing(self, gw, monkeypatch):
        posts: list = []
        _capture(monkeypatch, posts=posts)
        responses_post.append(_resp(200, json.dumps({"refund_id": "503001", "status": "PROCESSING"})))
        result = gw.create_refund("O-1", "O-1", 1, 1, "退款", notify_url="")
        assert result.status == RefundStatus.PROCESSING and result.wx_refund_id == "503001"
        # 退款回调开关：请求必须带 notify_url
        assert posts[0][1]["json"]["notify_url"] == NOTIFY_URL

    def test_not_enough_is_manual(self, gw, monkeypatch):
        """余额不足（不自愈）→ manual，转人工不空转。"""
        result, _ = self._reject(gw, monkeypatch, 403, "NOT_ENOUGH")
        assert result.status == RefundStatus.UNKNOWN and result.error_kind == "manual"

    def test_user_abnormal_is_manual(self, gw, monkeypatch):
        result, _ = self._reject(gw, monkeypatch, 403, "USER_ACCOUNT_ABNORMAL")
        assert result.error_kind == "manual"

    def test_frequency_limited_is_retryable(self, gw, monkeypatch):
        result, _ = self._reject(gw, monkeypatch, 429, "FREQUENCY_LIMITED")
        assert result.error_kind == "retryable"

    def test_order_not_ready_is_retryable(self, gw, monkeypatch):
        result, _ = self._reject(gw, monkeypatch, 409, "ORDER_NOT_READY")
        assert result.error_kind == "retryable"


class TestQueryRefund:

    def test_success(self, gw, monkeypatch):
        _capture(monkeypatch)
        responses_get.append(_resp(200, json.dumps({"refund_id": "503001", "status": "SUCCESS"})))
        r = gw.query_refund("O-1")
        assert r.status == RefundStatus.SUCCESS and r.wx_refund_id == "503001"

    def test_not_found_flags_receipt_lost(self, gw, monkeypatch):
        """查无退款单 = 受理丢失信号。"""
        _capture(monkeypatch)
        responses_get.append(_resp(404, json.dumps({"code": "RESOURCE_NOT_EXISTS"})))
        r = gw.query_refund("O-404")
        assert r.status == RefundStatus.UNKNOWN and r.error_kind == "not_found"

    def test_abnormal(self, gw, monkeypatch):
        _capture(monkeypatch)
        responses_get.append(_resp(200, json.dumps({"refund_id": "503001", "status": "ABNORMAL"})))
        assert gw.query_refund("O-1").status == RefundStatus.ABNORMAL


# ════════════ 账单（任务 2.3：双张分下 + 元转分 + SHA1）════════════

ALL_CSV = (
    "`记账日期,`微信支付商户号,`微信订单号,`商户订单号,`交易状态,`交易成功时间,`应结订单金额（元）\r\n"
    "`2026-08-31 10:00:00,`1749993584,`50001234562026083101,`O-BILL1,`SUCCESS,`2026-08-31 10:00:05,`0.01\r\n"
    "`2026-08-31 11:00:00,`1749993584,`50001234562026083102,`O-BILL2,`SUCCESS,`2026-08-31 11:00:05,`72.00\r\n"
    "`总交易单数,`总应结订单金额（元）,`总手续费（元）\r\n"
    "`2,`72.01,`0.00000\r\n"
)
REFUND_CSV = (
    "`记账日期,`微信支付商户号,`微信订单号,`商户订单号,`退款金额（元）,`退款成功时间\r\n"
    "`2026-08-31 12:00:00,`1749993584,`50001234562026083102,`O-BILL2,`72.00,`2026-08-31 12:05:00\r\n"
    "`总退款单数,`总退款金额（元）\r\n"
    "`1,`72.00\r\n"
)


def _bill_response(csv_text: str) -> tuple:
    csv_bytes = csv_text.encode("UTF-8")
    # 微信账单下载响应非 JSON（Content-Type 非 application/json），SDK 返回 bytes
    download = _resp(200, gzip.compress(csv_bytes), content_type="application/octet-stream")
    meta = _resp(200, json.dumps({
        "download_url": "https://api.mch.weixin.qq.com/v3/billdownload/file?token=x",
        "hash_type": "SHA1",
        "hash_value": hashlib.sha1(csv_bytes).hexdigest().upper(),
    }))
    return [meta, download]


class TestDownloadBill:

    def test_two_bills_parsed_yuan_to_fen(self, gw, monkeypatch):
        gets: list = []
        _capture(monkeypatch, gets=gets)
        responses_get.extend(_bill_response(ALL_CSV) + _bill_response(REFUND_CSV))
        lines = gw.download_bill("2026-08-31")
        # 申请两次账单：bill_type=ALL 与 REFUND（退款明细不混在 ALL）
        assert "bill_type=ALL" in gets[0][0] and "bill_type=REFUND" in gets[2][0]
        assert [ln.status for ln in lines] == ["SUCCESS", "SUCCESS", "REFUND"]
        # 元→分换算（0.01 元 → 1 分；72.00 元 → 7200 分）
        assert lines[0].amount_fen == 1 and lines[1].amount_fen == 7200
        assert lines[0].out_trade_no == "O-BILL1"
        assert lines[2].out_trade_no == "O-BILL2" and lines[2].amount_fen == 7200

    def test_hash_mismatch_raises(self, gw, monkeypatch):
        _capture(monkeypatch)
        csv_bytes = ALL_CSV.encode("UTF-8")
        meta = _resp(200, json.dumps({
            "download_url": "https://api.mch.weixin.qq.com/v3/billdownload/file?token=x",
            "hash_type": "SHA1", "hash_value": "0" * 40}))
        responses_get.extend([meta, _resp(200, gzip.compress(csv_bytes), content_type="application/octet-stream")])
        import pytest
        with pytest.raises(RuntimeError, match="mismatch"):
            gw.download_bill("2026-08-31")

    def test_tradebill_rejected_raises(self, gw, monkeypatch):
        """下载失败必须抛错（T4 记 error），不得静默变空列表伪装平衡。"""
        _capture(monkeypatch)
        responses_get.append(_resp(403, json.dumps({"code": "NO_AUTH"})))
        import pytest
        with pytest.raises(RuntimeError, match="tradebill"):
            gw.download_bill("2026-08-31")


class TestBillCsvParsing:

    def test_strip_backtick_and_summary_stop(self):
        lines = _parse_bill_csv(ALL_CSV.replace("\r\n", "\n"), bill_type="ALL")
        assert len(lines) == 2  # 汇总行截停，不产生伪行
        assert lines[1].transaction_id == "50001234562026083102"

    def test_empty_amount_skipped(self):
        csv_text = (
            "`记账日期,`微信订单号,`商户订单号,`交易状态,`交易成功时间,`应结订单金额（元）\n"
            "`2026-08-31,`T1,`O-1,`SUCCESS,`2026-08-31 10:00:00,`\n"  # 空金额
            "`总交易单数,`0\n"
        )
        assert _parse_bill_csv(csv_text, bill_type="ALL") == []

    def test_fen_from_yuan(self):
        assert _fen_from_yuan("0.01") == 1
        assert _fen_from_yuan("72.00") == 7200
        assert _fen_from_yuan("239.20") == 23920
        assert _fen_from_yuan("") == 0
        assert _fen_from_yuan("abc") == 0
