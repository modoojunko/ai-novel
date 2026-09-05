"""设备授权页地址构造（_build_auth_url）— 纯函数单测。

授权页由 S端 前端 /auth 唯一承载（后端内联页已删除，openspec: auth-page-direct-entry）：
从 public_server_api（…/api）剥掉 /api 得 web origin，query 三参 pc_hash /
pc_name / device_profile 原样随 URL 传递。
"""

from urllib.parse import urlparse, parse_qs

from auth_local.service import _build_auth_url


def _split(url: str):
    parsed = urlparse(url)
    return parsed, parse_qs(parsed.query)


def test_api_suffix_stripped_for_web_origin():
    url = _build_auth_url("https://www.awesomenovel.com/api", "h1", "Mac", "prof")
    assert url.startswith("https://www.awesomenovel.com/auth?")
    assert "/api" not in urlparse(url).path


def test_trailing_slash_tolerated():
    url = _build_auth_url("https://www.awesomenovel.com/api/", "h1", "", "prof")
    assert url.startswith("https://www.awesomenovel.com/auth?")


def test_bare_domain_without_api_kept_as_is():
    """显式自定义子路径（无 /api 后缀）不改动——保留网关侧任意映射能力。"""
    url = _build_auth_url("https://gw.example.com/srv/api", "h1", "", "prof")
    assert url.startswith("https://gw.example.com/srv/auth?")


def test_query_carries_three_params():
    _, qs = _split(_build_auth_url("https://x.example.com/api", "hash-abc", "工作台-Mac", "profXYZ"))
    assert qs["pc_hash"] == ["hash-abc"]
    assert qs["pc_name"] == ["工作台-Mac"]
    assert qs["device_profile"] == ["profXYZ"]


def test_pc_name_urlencoded_in_raw_url():
    raw = _build_auth_url("https://x.example.com/api", "h", "My Mac", "p")
    assert "My%20Mac" in raw
    _, qs = _split(raw)
    assert qs["pc_name"] == ["My Mac"]


def test_urlsafe_base64_profile_untouched():
    """URL-safe Base64 字母表（A-Za-z0-9-_）不含 +/=，原样拼接不失真。"""
    profile = "eyJmIjoiYWIjLTxfIn0"  # 仅安全字母表（含 - 与 _）
    raw = _build_auth_url("https://x.example.com/api", "h", "", profile)
    assert f"device_profile={profile}" in raw
