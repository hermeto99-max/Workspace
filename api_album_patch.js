// Add the /api/album/:album_id endpoint to fetch album details by album_id
const express = require('express');
const mysql = require('mysql2/promise');

// ...existing code...

app.get('/api/album/:album_id', async (req, res) => {
  const album_id = req.params.album_id;
  let conn;
  try {
    conn = await mysql.createConnection(config);
    const [rows] = await conn.query(
      'SELECT artist_name, artist_fname, title, grading FROM albums WHERE album_id = ?',
      [album_id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Album not found' });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('API /api/album/:album_id error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (conn) await conn.end();
  }
});
// ...existing code...
