import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch

# =========================
# CONFIGURACIÓN
# =========================
EXCEL_PATH = r"C:\Users\ivanf\Desktop\2026\EMPRESAS\AYTO SANTA CRUZ\INVENTARIO DEFINITIVO\mio.xlsx"

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "vivero",
    "user": "vivero",
    "password": "vivero123",
}

TABLE_NAME = "productos"

# =========================
# CARGA DEL EXCEL
# =========================
df = pd.read_excel(EXCEL_PATH)

required_columns = {
    "id",
    "nombre_natural",
    "nombre_cientifico",
    "categoria",
    "subcategoria",
    "stock_minimo",
}

missing = required_columns - set(df.columns)
if missing:
    raise ValueError(f"Faltan columnas obligatorias en el Excel: {sorted(missing)}")

# Limpieza básica
df = df[list(required_columns)].copy()
df["id"] = pd.to_numeric(df["id"], errors="coerce")
df["stock_minimo"] = pd.to_numeric(df["stock_minimo"], errors="coerce").fillna(0).astype(int)

for col in ["nombre_natural", "nombre_cientifico", "categoria", "subcategoria"]:
    df[col] = df[col].fillna("").astype(str).str.strip()

df = df.dropna(subset=["id"])
df["id"] = df["id"].astype(int)
df = df.drop_duplicates(subset=["id"], keep="last")

# =========================
# CONEXIÓN A POSTGRES
# =========================
conn = psycopg2.connect(**DB_CONFIG)
conn.autocommit = False

try:
    with conn.cursor() as cur:
        # 1) Comprobar qué IDs existen en BD
        excel_ids = df["id"].tolist()

        cur.execute(
            f"SELECT id FROM {TABLE_NAME} WHERE id = ANY(%s)",
            (excel_ids,)
        )
        existing_ids = {row[0] for row in cur.fetchall()}

        missing_ids = sorted(set(excel_ids) - existing_ids)
        if missing_ids:
            print("⚠️ Estos IDs están en el Excel pero NO existen en la BD:")
            print(missing_ids[:50])
            if len(missing_ids) > 50:
                print(f"... y {len(missing_ids) - 50} más")

        # 2) Preparar solo registros existentes
        df_update = df[df["id"].isin(existing_ids)].copy()

        if df_update.empty:
            raise ValueError("No hay IDs válidos para actualizar.")

        rows = [
            (
                row["nombre_natural"],
                row["nombre_cientifico"],
                row["categoria"],
                row["subcategoria"],
                int(row["stock_minimo"]),
                int(row["id"]),
            )
            for _, row in df_update.iterrows()
        ]

        # 3) UPDATE por id
        sql = f"""
            UPDATE {TABLE_NAME}
            SET
                nombre_natural = %s,
                nombre_cientifico = %s,
                categoria = %s,
                subcategoria = %s,
                stock_minimo = %s
            WHERE id = %s
        """

        execute_batch(cur, sql, rows, page_size=200)

        print(f"✅ Productos actualizados: {len(rows)}")
        conn.commit()

except Exception as e:
    conn.rollback()
    print(f"❌ Error: {e}")
    raise

finally:
    conn.close()