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
