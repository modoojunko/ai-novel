"""API 路径前缀归一化（域名按路径路由兼容层）— 进程内 TestClient。

线上统一域名配了「/api/ → 后端」的路由规则且转发剥前缀；直连云托管域名
则前缀原样保留。两种进法都必须命中同一套路由：
  /check-auth        （剥前缀形态）→ 内部改写为 /api/check-auth
  /api/check-auth    （原生形态，保持原样）
"""

from tests.conftest import WEB_PASSWORD


def test_stripped_form_hits_check_auth(client):
    r = client.get("/check-auth", params={"pc_hash": "x"})
    assert r.status_code == 200
    body = r.json()
    assert "code" in body


def test_prefixed_form_unchanged(client):
    r = client.get("/api/check-auth", params={"pc_hash": "x"})
    assert r.status_code == 200
    assert "code" in r.json()


def test_stripped_form_hits_auth_page_html(client):
    r = client.get("/auth-page", params={"pc_hash": "x"})
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")


def test_stripped_post_reaches_validation(client):
    """剥前缀形态的 POST 也应命中路由：空体 → 参数校验 422 而非 404。"""
    r = client.post("/web/login", json={})
    assert r.status_code == 422


def test_unknown_path_not_remapped(client):
    """非真实路由不归一化：裸形态仍 404（而非误改写成别的资源）。"""
    assert client.get("/web/nonexistent").status_code == 404
    assert client.get("/zzz-not-a-route").status_code == 404


def test_register_via_both_forms_same_result(client, uid):
    """同一账号经两种路径形态注册：先到的成功、后到的报用户名重复。"""
    payload = {
        "username": f"np_{uid}",
        "password": WEB_PASSWORD,
        "security_question": "q?",
        "security_answer": "a",
    }
    first = client.post("/web/register", json=payload)
    assert first.json()["code"] == 0, first.text

    again = client.post("/api/web/register", json=payload)
    assert again.json()["code"] != 0
