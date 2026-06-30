import os
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


def mask_url(url: str) -> str:
    parsed = urlsplit(url)
    if "@" not in parsed.netloc:
        return url

    credentials, host = parsed.netloc.rsplit("@", 1)
    user = credentials.split(":", 1)[0]
    return urlunsplit((parsed.scheme, f"{user}:***@{host}", parsed.path, parsed.query, parsed.fragment))


def main():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise SystemExit("DATABASE_URL is not set. Add your Supabase pooled Postgres connection string.")

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    print(f"Checking database: {mask_url(database_url)}")
    engine = create_engine(database_url, pool_pre_ping=True)

    with engine.connect() as connection:
        row = connection.execute(text("select current_database(), current_user, inet_server_addr(), version()")).one()
        tables = connection.execute(
            text(
                """
                select count(*)
                from information_schema.tables
                where table_schema = 'public'
                """
            )
        ).scalar_one()

    print(f"Connected to database: {row[0]}")
    print(f"Connected as user: {row[1]}")
    print(f"Server address: {row[2]}")
    print(f"Postgres version: {row[3].split(',')[0]}")
    print(f"Public table count: {tables}")


if __name__ == "__main__":
    main()
