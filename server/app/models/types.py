"""跨数据库 BigInteger 主键类型：sqlite 用 Integer（支持 autoincrement），PG 用 BigInteger。"""
from sqlalchemy import BigInteger, Integer

BigIntPK = BigInteger().with_variant(Integer(), "sqlite")
