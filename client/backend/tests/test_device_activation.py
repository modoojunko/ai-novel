"""C端 设备注册与激活 — 编解码 + 采集函数测试"""

import base64
import json
from unittest.mock import patch

# ── encode_device_profile 测试 ──


def test_encode_device_profile_roundtrip():
    """编解码往返一致"""
    from auth_local.service import encode_device_profile

    result = encode_device_profile(
        {
            "fingerprint": "FP-001-ABCD",
            "hostname": "主开发机",
            "os": "Windows 11",
            "os_arch": "AMD64",
        }
    )
    assert isinstance(result, str)
    assert "=" not in result  # no padding

    # decode & verify
    raw = base64.urlsafe_b64decode(result + "==")
    data = json.loads(raw)
    assert data["f"] == "FP-001-ABCD"
    assert data["h"] == "主开发机"
    assert data["o"] == "Windows 11"
    assert data["a"] == "AMD64"


def test_encode_device_profile_empty_fields():
    """空字段编码正常"""
    from auth_local.service import encode_device_profile

    result = encode_device_profile(
        {
            "fingerprint": "",
            "hostname": "",
            "os": "",
            "os_arch": "",
        }
    )
    assert isinstance(result, str)
    raw = base64.urlsafe_b64decode(result + "==")
    data = json.loads(raw)
    assert data["f"] == ""
    assert data["h"] == ""


def test_encode_device_profile_minimal():
    """仅 fingerprint 也能编码"""
    from auth_local.service import encode_device_profile

    result = encode_device_profile({"fingerprint": "FP-X"})
    raw = base64.urlsafe_b64decode(result + "==")
    data = json.loads(raw)
    assert data["f"] == "FP-X"
    assert data["h"] == ""


# ── collect_device_profile 测试 ──


def test_collect_device_profile_fallback_on_no_wmic():
    """当 wmic 不可用时（非 Windows 或 wmic 不存在），使用 platform 兜底"""

    from auth_local.service import collect_device_profile

    with (
        patch("subprocess.run", side_effect=FileNotFoundError("no wmic")),
        patch("platform.node", return_value="test-pc"),
        patch("platform.platform", return_value="Linux-5.15-x86_64"),
        patch("platform.machine", return_value="x86_64"),
    ):
        profile = collect_device_profile()
        assert profile["hostname"] == "test-pc"
        assert profile["os"] == "Linux-5.15-x86_64"
        assert profile["os_arch"] == "x86_64"
        assert len(profile["fingerprint"]) == 64  # sha256 hex


def test_collect_device_profile_includes_fingerprint():
    """fingerprint 一定是 64 字符 hex 字符串"""
    from auth_local.service import collect_device_profile

    with (
        patch("subprocess.run", side_effect=FileNotFoundError("no wmic")),
        patch("platform.node", return_value="test-pc"),
        patch("platform.platform", return_value="Linux"),
        patch("platform.machine", return_value="x86_64"),
    ):
        profile = collect_device_profile()
        assert len(profile["fingerprint"]) == 64
        # 验证是 hex
        int(profile["fingerprint"], 16)


def test_collect_device_profile_wmic_success():
    """wmic 成功时使用硬件信息生成 fingerprint"""
    from auth_local.service import collect_device_profile

    class MockResult:
        returncode = 0
        stdout = "Header\nCPU-123\n"
        stderr = ""

    with (
        patch("subprocess.run", return_value=MockResult()),
        patch("platform.node", return_value="real-pc"),
        patch("platform.platform", return_value="Windows 11"),
        patch("platform.machine", return_value="AMD64"),
    ):
        profile = collect_device_profile()
        assert profile["hostname"] == "real-pc"
        assert len(profile["fingerprint"]) == 64
        # fingerprint 是 wmic 输出拼接后的 sha256
        import hashlib

        expected = hashlib.sha256(b"CPU-123-CPU-123-CPU-123").hexdigest()
        assert profile["fingerprint"] == expected


# ── S端 编解码兼容性验证 ──


def test_encode_decode_compatible_format():
    """C端 编码格式与 S端 期望的格式一致（短字段名）"""
    from auth_local.service import encode_device_profile

    device_info = {
        "fingerprint": "a1b2c3d4e5f6",
        "hostname": "MY-PC",
        "os": "Windows 10",
        "os_arch": "x86_64",
    }
    encoded = encode_device_profile(device_info)
    assert isinstance(encoded, str)

    # 验证 payload 结构：使用短字段名 f/h/o/a
    raw = base64.urlsafe_b64decode(encoded + "==")
    data = json.loads(raw)
    assert "f" in data  # fingerprint
    assert "h" in data  # hostname
    assert "o" in data  # os
    assert "a" in data  # os_arch
    assert data["f"] == "a1b2c3d4e5f6"
    assert data["h"] == "MY-PC"
    assert data["o"] == "Windows 10"
    assert data["a"] == "x86_64"
