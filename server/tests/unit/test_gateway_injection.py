"""支付网关注入三分支单测（s-pay-wechat-gateway 任务 1.2）。

mock → MockPaymentGateway；wxpay 配置缺 → RuntimeError 列缺失项；
wxpay 配置齐 → WechatPayGateway（测试内现生成 RSA 密钥对，公钥模式下
SDK 构造不触发网络）；未知值 → fail-fast。
"""
from __future__ import annotations

from types import SimpleNamespace

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import settings
from app.infrastructure.payments.gateway import MockPaymentGateway
from app.main import init_payment_gateway

WXPAY_KEYS = (
    "WXPAY_MCH_ID", "WXPAY_APPID", "WXPAY_CERT_SERIAL",
    "WXPAY_PRIVATE_KEY_PATH", "WXPAY_APIV3_KEY",
    "WXPAY_PUB_KEY_ID", "WXPAY_PUB_KEY_PATH", "WXPAY_NOTIFY_URL",
)


def _gen_rsa_pair(tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption()).decode()
    pub = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    priv_path, pub_path = tmp_path / "k.pem", tmp_path / "pub.pem"
    priv_path.write_text(priv)
    pub_path.write_text(pub)
    return str(priv_path), str(pub_path)


def _wxpay_settings(monkeypatch, tmp_path):
    priv_path, pub_path = _gen_rsa_pair(tmp_path)
    monkeypatch.setattr(settings, "PAYMENTS_GATEWAY", "wxpay")
    monkeypatch.setattr(settings, "WXPAY_MCH_ID", "1749993584")
    monkeypatch.setattr(settings, "WXPAY_APPID", "wx41899938fa14c26d")
    monkeypatch.setattr(settings, "WXPAY_CERT_SERIAL", "1AEE63CDDC185649611F9C7B49FECED290DACD09")
    monkeypatch.setattr(settings, "WXPAY_PRIVATE_KEY_PATH", priv_path)
    monkeypatch.setattr(settings, "WXPAY_APIV3_KEY", "x" * 32)
    monkeypatch.setattr(settings, "WXPAY_PUB_KEY_ID", "PUB_KEY_ID_011749993584")
    monkeypatch.setattr(settings, "WXPAY_PUB_KEY_PATH", pub_path)
    monkeypatch.setattr(settings, "WXPAY_NOTIFY_URL", "https://www.example.com/api/pay/notify")


class TestGatewayInjection:

    def test_mock_branch(self, monkeypatch):
        monkeypatch.setattr(settings, "PAYMENTS_GATEWAY", "mock")
        app = SimpleNamespace(state=SimpleNamespace())
        init_payment_gateway(app)
        assert isinstance(app.state.payment_gateway, MockPaymentGateway)

    def test_unknown_value_fails_fast(self, monkeypatch):
        monkeypatch.setattr(settings, "PAYMENTS_GATEWAY", "alipay")
        import pytest
        with pytest.raises(RuntimeError, match="不支持"):
            init_payment_gateway(SimpleNamespace(state=SimpleNamespace()))

    def test_wxpay_missing_config_rejected(self, monkeypatch):
        """wxpay 但配置全空 → RuntimeError 列出缺失项，绝不静默回落 Mock。"""
        monkeypatch.setattr(settings, "PAYMENTS_GATEWAY", "wxpay")
        for key in WXPAY_KEYS:
            monkeypatch.setattr(settings, key, "")
        import pytest
        with pytest.raises(RuntimeError) as excinfo:
            init_payment_gateway(SimpleNamespace(state=SimpleNamespace()))
        assert "WXPAY_MCH_ID 未配置" in str(excinfo.value)
        assert "WXPAY_NOTIFY_URL 未配置" in str(excinfo.value)

    def test_wxpay_ready_builds_gateway(self, monkeypatch, tmp_path):
        _wxpay_settings(monkeypatch, tmp_path)
        from app.infrastructure.payments.wechatpay import WechatPayGateway
        app = SimpleNamespace(state=SimpleNamespace())
        init_payment_gateway(app)
        assert isinstance(app.state.payment_gateway, WechatPayGateway)
