import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taller_web',
  port: Number(process.env.DB_PORT) || 3306,
};

export async function connectDB() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    // end() se puede llamar varias veces: las rutas viejas cierran en cada rama y además en finally.
    const cerrar = connection.end.bind(connection);
    let cerrada = false;
    connection.end = (async () => {
      if (cerrada) return;
      cerrada = true;
      await cerrar();
    }) as typeof connection.end;
    return connection;
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
}
