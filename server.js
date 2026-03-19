require('dotenv').config();
const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'admin',
  password: process.env.MYSQL_PASSWORD || 'Crkva505@1',
  database: process.env.MYSQL_DATABASE || 'Media',
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
};

// Serve workspace files (collection.html, home.html, etc.)
app.use('/', express.static(path.join(__dirname)));
// Serve images from the provided absolute folder
app.use('/images', express.static('/home/hermeto/Public/images'));

app.get('/api/albums', async (req, res) => {
  const perPage = Math.max(1, Number(req.query.perPage) || 10);
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * perPage;
  const orderBy = req.query.orderBy === 'year' ? 'YEAR' : req.query.orderBy === 'author' ? 'artist_name, artist_fname' : 'YEAR';
  const orderDir = req.query.orderDir === 'desc' ? 'DESC' : 'ASC';
  const search = req.query.search ? req.query.search.trim() : '';

  let conn;
  try {
    conn = await mysql.createConnection(config);
    let where = '';
    let params = [];
    if (search) {
      where = "WHERE CONCAT(artist_name, ' ', artist_fname) LIKE ?";
      params.push(`%${search}%`);
    }
    // Get filtered count
    const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM albums ${where}`, params);
    // Sort the filtered table, then paginate
    const [rows] = await conn.query(
      `SELECT * FROM (SELECT picture, artist_fname, artist_name, title, YEAR AS year FROM albums ${where}) AS sorted_albums ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    res.json({
      total: Number(count),
      page,
      perPage,
      data: rows,
    });
  } catch (err) {
    console.error('API /api/albums error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (conn) await conn.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
