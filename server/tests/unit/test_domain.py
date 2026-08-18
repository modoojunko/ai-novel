"""领域层单元测试：tier_policy、ActivationPolicy、DeviceProfile。"""

from __future__ import annotations

from datetime import UTC, date, datetime

from app.domain.devices.activation_policy import ActivationPolicy
from app.domain.devices.device import DeviceProfile, DeviceRegistry
from app.domain.licensing import tier_policy

# ══════════════════════════════════════════════════════════════════
# tier_policy
# ══════════════════════════════════════════════════════════════════

class TestTierPolicy:
    def test_device_limit_mapping(self):
        assert tier_policy.get_device_limit("none") == 0
        assert tier_policy.get_device_limit("trial") == 1
        assert tier_policy.get_device_limit("free") == 1
        assert tier_policy.get_device_limit("monthly") == 3
        assert tier_policy.get_device_limit("quarterly") == 3
        assert tier_policy.get_device_limit("yearly") == 5
        assert tier_policy.get_device_limit("lifetime") == 99
        assert tier_policy.get_device_limit("unknown") == 1  # fallback

    def test_duration_days(self):
        assert tier_policy.get_duration_days("trial") == 7
        assert tier_policy.get_duration_days("monthly") == 30
        assert tier_policy.get_duration_days("quarterly") == 90
        assert tier_policy.get_duration_days("yearly") == 365
        assert tier_policy.get_duration_days("lifetime") == 36500
        assert tier_policy.get_duration_days("free") == 0
        assert tier_policy.get_duration_days("none") == 0

    def test_display_name(self):
        assert tier_policy.get_display_name("trial") == "试用"
        assert tier_policy.get_display_name("monthly") == "月付"
        assert tier_policy.get_display_name("none") == "无套餐"

    def test_calc_expires_at(self):
        base = date(2026, 7, 29)
        assert tier_policy.calc_expires_at("trial", base) == date(2026, 8, 5)
        assert tier_policy.calc_expires_at("monthly", base) == date(2026, 8, 28)
        assert tier_policy.calc_expires_at("none", base) == base  # 0 days


# ══════════════════════════════════════════════════════════════════
# ActivationPolicy
# ══════════════════════════════════════════════════════════════════

def _device(
    fingerprint: str,
    last_active: str,
    hostname: str = "测试机",
) -> DeviceRegistry:
    return DeviceRegistry(
        id=f"id-{fingerprint}",
        user_id="testuser",
        fingerprint=fingerprint,
        hostname=hostname,
        os="Windows-11",
        os_arch="AMD64",
        last_active_at=datetime.fromisoformat(last_active),
        bound_at=datetime.now(UTC),
    )


class TestActivationPolicy:
    def test_top_2_of_3(self):
        """UT-1: 3 台设备，限额 2"""
        devices = [
            _device("A", "2026-07-28T14:00:00+00:00"),
            _device("B", "2026-07-27T10:00:00+00:00"),
            _device("C", "2026-07-26T08:00:00+00:00"),
        ]
        result_a = ActivationPolicy.compute(devices, 2, "A", "free")
        assert result_a["activated"] is True
        assert result_a["activated_count"] == 2
        assert result_a["total_count"] == 3

        result_c = ActivationPolicy.compute(devices, 2, "C", "free")
        assert result_c["activated"] is False
        assert result_c["reason"]["code"] == "limit_exceeded"

    def test_account_inactive_all_deactivated(self):
        """UT-2: 无套餐用户（tier=none）所有设备未激活"""
        devices = [_device("A", "2026-07-28T14:00:00+00:00")]
        result = ActivationPolicy.compute(devices, 0, "A", "none")
        assert result["activated"] is False
        assert result["reason"]["code"] == "account_inactive"
        assert result["active_limit"] == 0
        assert result["activated_count"] == 0

    def test_empty_device_list(self):
        """UT-3: 空设备列表"""
        result = ActivationPolicy.compute([], 1, "", "free")
        assert result["activated"] is False
        assert result["total_count"] == 0
        assert result["activated_count"] == 0

    def test_compute_all_returns_all_devices(self):
        """UT-4: compute_all 返回所有设备及激活状态"""
        devices = [
            _device("A", "2026-07-28T14:00:00+00:00", "主开发机"),
            _device("B", "2026-07-27T10:00:00+00:00", "办公本"),
        ]
        results = ActivationPolicy.compute_all(devices, 1, "free")
        assert len(results) == 2
        assert results[0]["activated"] is True
        assert results[1]["activated"] is False
        assert results[1]["reason"]["code"] == "limit_exceeded"

    def test_compute_all_empty(self):
        """UT-5: compute_all 空列表返回空"""
        assert ActivationPolicy.compute_all([], 1, "free") == []


# ══════════════════════════════════════════════════════════════════
# DeviceProfile 编解码
# ══════════════════════════════════════════════════════════════════

class TestDeviceProfileCodec:
    def test_roundtrip(self):
        """编解码往返一致"""
        original = DeviceProfile(fingerprint="FP-001", hostname="PC1", os="Windows", os_arch="x86_64")
        encoded = original.to_b64()
        decoded = DeviceProfile.from_b64(encoded)
        assert decoded.fingerprint == "FP-001"
        assert decoded.hostname == "PC1"
        assert decoded.os == "Windows"
        assert decoded.os_arch == "x86_64"

    def test_empty_input(self):
        """空字符串返回空字段"""
        decoded = DeviceProfile.from_b64("")
        assert decoded.fingerprint == ""
        assert decoded.hostname == ""

    def test_missing_padding(self):
        """缺少 padding 的 Base64 正常解码"""
        original = DeviceProfile(fingerprint="FP-002", hostname="PC2", os="", os_arch="")
        encoded = original.to_b64().rstrip("=")
        assert "=" not in encoded
        decoded = DeviceProfile.from_b64(encoded)
        assert decoded.fingerprint == "FP-002"

    def test_invalid_base64(self):
        """非法 Base64 返回空字段"""
        decoded = DeviceProfile.from_b64("!!!not-base64!!!")
        assert decoded.fingerprint == ""

    def test_valid_base64_not_json(self):
        """合法 Base64 但非 JSON 返回空字段"""
        import base64
        encoded = base64.urlsafe_b64encode(b"not-json").decode()
        decoded = DeviceProfile.from_b64(encoded)
        assert decoded.fingerprint == ""

    def test_missing_fields(self):
        """缺少字段时默认空字符串"""
        import base64
        import json
        encoded = base64.urlsafe_b64encode(json.dumps({"unknown": "value"}).encode()).decode()
        decoded = DeviceProfile.from_b64(encoded)
        assert decoded.fingerprint == ""
        assert decoded.hostname == ""
