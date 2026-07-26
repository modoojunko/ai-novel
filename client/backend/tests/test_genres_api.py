"""Tests for the genres API (GET /api/genres)."""

import httpx

BASE_URL = "http://localhost:8000/api"


class TestGenresAPI:
    def test_list_genres_returns_groups(self):
        """GET /genres returns structured category groups."""
        resp = httpx.get(f"{BASE_URL}/genres")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0  # at least one category group

        # Each group has category and genres list
        for group in data:
            assert "category" in group
            assert "genres" in group
            assert isinstance(group["genres"], list)
            for g in group["genres"]:
                assert "id" in g
                assert "label" in g
                assert "description" in g
                assert "category" in g

    def test_list_genres_categories_are_valid(self):
        """Each returned category is non-empty and genres have required fields."""
        resp = httpx.get(f"{BASE_URL}/genres")
        assert resp.status_code == 200
        for group in resp.json():
            cat = group["category"]
            assert isinstance(cat, str) and len(cat) > 0
            for g in group["genres"]:
                assert g["id"]
                assert g["label"]

    def test_get_genre_by_id_returns_full_data(self):
        """GET /genres/{id} returns full genre definition."""
        # First get the list to find an ID
        list_resp = httpx.get(f"{BASE_URL}/genres")
        assert list_resp.status_code == 200
        groups = list_resp.json()
        first_genre = groups[0]["genres"][0]
        genre_id = first_genre["id"]

        # Fetch full data
        resp = httpx.get(f"{BASE_URL}/genres/{genre_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == genre_id
        assert "label" in data
        assert "category" in data
        assert "description" in data

    def test_get_genre_with_all_fields(self):
        """Full genre data includes style_blueprint, genre_taboos, prompt_segment, genre_config."""
        # Pick scifi-apocalypse which should have full data
        resp = httpx.get(f"{BASE_URL}/genres/scifi-apocalypse")
        assert resp.status_code == 200
        data = resp.json()
        assert "style_blueprint" in data
        assert "genre_taboos" in data
        assert len(data["genre_taboos"]) > 0
        assert "prompt_segment" in data
        assert "genre_config" in data
        assert "satisfaction_types" in data["genre_config"]

    def test_get_genre_not_found(self):
        """Non-existent genre ID returns 404."""
        resp = httpx.get(f"{BASE_URL}/genres/nonexistent-genre")
        assert resp.status_code == 404

    def test_genre_has_expected_structure(self):
        """Each genre in the list has required fields."""
        resp = httpx.get(f"{BASE_URL}/genres")
        assert resp.status_code == 200
        for group in resp.json():
            for g in group["genres"]:
                assert g["id"], f"Genre missing id: {g}"
                assert g["label"], f"Genre missing label: {g}"
                assert g["description"], f"Genre missing description: {g}"
                assert g["category"], f"Genre missing category: {g}"
