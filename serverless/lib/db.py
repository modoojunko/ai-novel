# serverless/lib/db.py
"""CloudBase 数据库操作封装"""

# CloudBase 云函数环境中通过环境变量获取数据库引用
# 使用全局单例避免每次调用都初始化
_db = None


def get_db():
    """获取 CloudBase 数据库引用"""
    global _db
    if _db is not None:
        return _db
    try:
        from tcb import tcb
        app = tcb.Database()
        _db = app.database()
        return _db
    except ImportError:
        # 本地开发时使用模拟
        raise RuntimeError("CloudBase SDK not available")


def get_collection(name: str):
    """获取集合引用"""
    db = get_db()
    return db.collection(name)
