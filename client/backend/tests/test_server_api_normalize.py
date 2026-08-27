"""S端 基址规范化（域名 /api 路由前缀）— 纯函数单测。

线上域名的路由规则用 /api/ 分流到 S端 后端，调用侧地址必须带该前缀；
_normalize_server_api 只对「裸域名」自动补 /api，显式带路径的配置不动。
"""

from auth_local.service import _normalize_server_api


def test_bare_host_gets_api_suffix():
    assert _normalize_server_api("https://novel.example.com") == "https://novel.example.com/api"


def test_trailing_slash_stripped_once():
    assert _normalize_server_api("https://novel.example.com/") == "https://novel.example.com/api"
    assert _normalize_server_api("https://novel.example.com///") == "https://novel.example.com/api"


def test_existing_api_path_untouched():
    assert _normalize_server_api("https://novel.example.com/api") == "https://novel.example.com/api"
    assert _normalize_server_api("https://novel.example.com/api/") == "https://novel.example.com/api"


def test_custom_subpath_untouched():
    """显式自定义子路径不改动——保留网关侧任意映射能力。"""
    assert (
        _normalize_server_api("https://gw.example.com/srv/api")
        == "https://gw.example.com/srv/api"
    )


def test_placeholder_default_untouched():
    assert (
        _normalize_server_api("https://your-cloudbase-app.com/api")
        == "https://your-cloudbase-app.com/api"
    )


def test_empty_stays_empty():
    """空串 = 未配置，交由调用方走默认链，不应被补成 '/api'。"""
    assert _normalize_server_api("") == ""
