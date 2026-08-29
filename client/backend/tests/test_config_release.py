"""release.json 发布期注入的读取逻辑（config.load_release_overrides）。"""
from config import load_release_overrides


def _write(tmp_path, body):
    p = tmp_path / "release.json"
    p.write_text(body, encoding="utf-8")
    return str(tmp_path)


def test_missing_file_returns_empty(tmp_path):
    assert load_release_overrides(str(tmp_path / "nope")) == {}


def test_valid_file_reads_nonempty_values_only(tmp_path):
    d = _write(tmp_path, '{"server_api_base": " https://www.example.com/api ", '
                          '"server_api_fallback": "", "public_server_api": null}')
    assert load_release_overrides(d) == {"server_api_base": "https://www.example.com/api"}


def test_unknown_and_malformed_are_tolerated(tmp_path):
    d = _write(tmp_path, '{"weird_key": 1, "server_api_base": "https://a.com/api", "extra": [1]}')
    assert load_release_overrides(d) == {"server_api_base": "https://a.com/api"}
    bad = _write(tmp_path, "{not json")
    assert load_release_overrides(bad) == {}
    nonobj = _write(tmp_path, '["array"]')
    assert load_release_overrides(nonobj) == {}


def test_client_update_keys_roundtrip(tmp_path):
    """client-update-notify 三键随 release.json 读取，空值/缺失容忍（→ 应用侧回退 dev/默认域）。"""
    d = _write(tmp_path, '{"client_version": "0.13", '
                          '"client_update_url": "https://www.awesomenovel.com/download/latest.json", '
                          '"client_update_url_fallback": "  ", "other": 1}')
    assert load_release_overrides(d) == {
        "client_version": "0.13",
        "client_update_url": "https://www.awesomenovel.com/download/latest.json",
    }
