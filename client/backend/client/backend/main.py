
@app.get("/api/debug-env")
async def debug_env():
    from auth_local.service import _get_server_api
    import os
    return {
        "SERVER_API_BASE_env": os.environ.get("SERVER_API_BASE", "NOT SET"),
        "SERVER_API_BASE_func": _get_server_api(),
        "DATA_ROOT": os.environ.get("DATA_ROOT", "NOT SET"),
        "cwd": os.getcwd(),
    }
