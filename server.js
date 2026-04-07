require('dotenv').config();
const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Utility to get or create MUSICIAN_ID
async function getOrCreateMusicianId(conn, musician_name, musician_family_name) {
  // Try to find existing musician_id
  const [rows] = await conn.query(
    'SELECT musician_id FROM musicians WHERE musician_name = ? AND musician_family_name = ?',
    [musician_name, musician_family_name]
  );
  if (rows.length > 0) {
    return rows[0].musician_id;
  }
  // Get the current max musician_id
  const [[{ maxId }]] = await conn.query('SELECT MAX(musician_id) AS maxId FROM musicians');
  const newId = (maxId || 0) + 1;
  // Insert new musician with newId and album_id
  // album_id must be passed as an extra argument
  throw new Error('getOrCreateMusicianId now requires album_id as third argument');
}

// Ensure upload directories exist
const sampleDir = '/home/hermeto/Public/samples';
const imageDir = '/home/hermeto/Public/images';
if (!fs.existsSync(sampleDir)) fs.mkdirSync(sampleDir, { recursive: true });
if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

// Multer storage config for each field
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'sample') cb(null, sampleDir);
      else if (file.fieldname === 'picture') cb(null, imageDir);
      else cb(new Error('Invalid field'));
    },
    filename: (req, file, cb) => {
      // Overwrite file if it already exists
      const destDir = file.fieldname === 'sample' ? sampleDir : file.fieldname === 'picture' ? imageDir : null;
      const filename = path.basename(file.originalname);
      if (destDir) {
        const fullPath = path.join(destDir, filename);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
        }
      }
      cb(null, filename);
    }
  })
});

// Upload endpoint for album files
app.post('/api/upload_album_files', upload.fields([
  { name: 'sample', maxCount: 1 },
  { name: 'picture', maxCount: 1 }
]), async (req, res) => {
  let conn;
  try {
    const files = req.files;
    const body = req.body;
    const tab1 = body;
    const sampleFile = files.sample ? files.sample[0].filename : null;
    const pictureFile = files.picture ? files.picture[0].filename : null;
    // Check for album_id
    if (!tab1.album_id || !String(tab1.album_id).trim()) {
      return res.status(400).json({ error: "Album Id is required. Please fill in the Album Id field." });
    }
    conn = await mysql.createConnection(config);

    // Insert album with user-provided album_id
    const sql = `INSERT INTO albums (album_id, title, artist_name, artist_fname, city, country, grading, value, published_by, month, year, filter, sample, picture, description, techDescription)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      tab1.album_id,
      tab1.title || '',
      tab1.artist_name || '',
      tab1.artist_fname || '',
      tab1.city || '',
      tab1.country || '',
      tab1.grading || '',
      tab1.value || '',
      tab1.published_by || '',
      tab1.month || '',
      tab1.year || '',
      tab1.filter || '',
      sampleFile,
      pictureFile,
      tab1.description || '',
      tab1.techDescription || ''
    ];
    await conn.query(sql, params);
    const album_id = tab1.album_id;

    // Insert musicians
    let musicians = [];
    try {
      musicians = JSON.parse(body.tab2 || '{}');
    } catch (e) {}
    const names = musicians.musician_name instanceof Array ? musicians.musician_name : (musicians.musician_name ? [musicians.musician_name] : []);
    const families = musicians.musician_family_name instanceof Array ? musicians.musician_family_name : (musicians.musician_family_name ? [musicians.musician_family_name] : []);
    const instruments = musicians.instruments instanceof Array ? musicians.instruments : (musicians.instruments ? [musicians.instruments] : []);
    for (let i = 0; i < names.length; i++) {
      const musician_name = names[i] || '';
      const musician_family_name = families[i] || '';
      const instr = instruments[i] || '';
      let musician_id;
      // Try to find existing musician_id
      const [rows] = await conn.query(
        'SELECT musician_id FROM musicians WHERE musician_name = ? AND musician_family_name = ?',
        [musician_name, musician_family_name]
      );
      if (rows.length > 0) {
        musician_id = rows[0].musician_id;
      } else {
        // Get the current max musician_id
        const [[{ maxId }]] = await conn.query('SELECT MAX(musician_id) AS maxId FROM musicians');
        musician_id = (maxId || 0) + 1;
        try {
          await conn.query(
            'INSERT INTO musicians (musician_id, musician_name, musician_family_name) VALUES (?, ?, ?)',
            [musician_id, musician_name, musician_family_name]
          );
        } catch (err) {
          console.error('Error inserting new musician:', {musician_id, musician_name, musician_family_name, error: err.message});
        }
      }
      try {
        await conn.query(
          'INSERT INTO musicians (musician_id, album_id, musician_name, musician_family_name, instruments) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE instruments=VALUES(instruments)',
          [musician_id, album_id, musician_name, musician_family_name, instr]
        );
      } catch (err) {
        console.error('Error inserting/updating musician:', {musician_id, album_id, musician_name, musician_family_name, instr, error: err.message});
      }
    }

    // Insert songs
    let songs = [];
    try {
      songs = JSON.parse(body.tab3 || '{}');
    } catch (e) {}
    const song_nos = songs.song_number instanceof Array ? songs.song_number : (songs.song_number ? [songs.song_number] : []);
    const song_titles = songs.song_title instanceof Array ? songs.song_title : (songs.song_title ? [songs.song_title] : []);
    const durations = songs.duration instanceof Array ? songs.duration : (songs.duration ? [songs.duration] : []);
    for (let i = 0; i < song_nos.length; i++) {
      const song_no = song_nos[i] || (i + 1);
      const song_title = song_titles[i] || '';
      const duration = durations[i] || '';
      try {
        await conn.query(
          'INSERT INTO songs (album_id, song_no, song_title, duration) VALUES (?, ?, ?, ?)',
          [album_id, song_no, song_title, duration]
        );
      } catch (err) {
        console.error('Error inserting song:', {album_id, song_no, song_title, duration, error: err.message});
      }
    }

    res.json({ message: 'Album, musicians, and songs uploaded', sample: sampleFile, picture: pictureFile, album_id });
  } catch (err) {
    console.error('Upload endpoint error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message || 'Upload error' });
  } finally {
    if (conn) await conn.end();
  }
});

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
// Serve audio samples from the provided absolute folder
app.use('/samples', express.static('/home/hermeto/Public/samples'));

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
      // Debug: log search, SQL, and params
      console.log('Search:', search);
    let where = '';
    let params = [];
    if (search) {
      where = "WHERE CONCAT(artist_name, ' ', artist_fname, ' ', title) LIKE ?";
      params.push(`%${search}%`);
    }
      const countSQL = `SELECT COUNT(*) AS count FROM albums ${where}`;
      console.log('Count SQL:', countSQL, 'Params:', params);
      const [[{ count }]] = await conn.query(countSQL, params);
    // Sort the filtered table, then paginate
      const dataSQL = `SELECT * FROM (SELECT album_id, picture, artist_fname, artist_name, title, YEAR AS year FROM albums ${where}) AS sorted_albums ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`;
      console.log('Data SQL:', dataSQL, 'Params:', [...params, perPage, offset]);
      const [rows] = await conn.query(dataSQL, [...params, perPage, offset]);

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


// Endpoint to get album details by album_id
app.get('/api/album/:album_id', async (req, res) => {
  const album_id = req.params.album_id;
  let conn;
  try {
    conn = await mysql.createConnection(config);
    const [rows] = await conn.query(
      'SELECT artist_name, artist_fname, title, grading, description, picture, sample, published_by, city, country, year, techDescription, value FROM albums WHERE album_id = ?',
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


// Delete album and related musicians and songs
app.delete('/api/album/:album_id', async (req, res) => {
  const album_id = req.params.album_id;
  let conn;
  try {
    console.log('DELETE endpoint called for album_id:', album_id);
    conn = await mysql.createConnection(config);
    // Disable safe updates
    await conn.query('SET SQL_SAFE_UPDATES = 0');
    // Delete songs first
    const [songResult] = await conn.query('DELETE FROM songs WHERE ALBUM_ID = ?', [album_id]);
    console.log('Songs deleted affectedRows:', songResult.affectedRows);
    // Delete musicians for this album
    const [musicianResult] = await conn.query('DELETE FROM musicians WHERE ALBUM_ID = ?', [album_id]);
    console.log('Musicians deleted affectedRows:', musicianResult.affectedRows);
    // Delete album
    const [albumResult] = await conn.query('DELETE FROM albums WHERE album_id = ?', [album_id]);
    console.log('Albums deleted affectedRows:', albumResult.affectedRows);
    // Re-enable safe updates
    await conn.query('SET SQL_SAFE_UPDATES = 1');
    if (albumResult.affectedRows === 0) {
      res.status(404).json({ error: 'Album not found' });
      return;
    }
    res.json({ message: 'Album and related data deleted' });
  } catch (err) {
    console.error('API DELETE /api/album/:album_id error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (conn) await conn.end();
  }
});


// Search musician by name and family name (expects full name in one string)
app.get('/search-musician', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) {
    return res.json({ success: false, error: 'No name provided' });
  }
  // Try to split into name and family name (assume last word is family name)
  const parts = name.split(' ');
  if (parts.length < 2) {
    return res.json({ success: false, error: 'Please provide both name and family name' });
  }
  const musician_family = parts.pop();
  const musician_name = parts.join(' ');
  let conn;
  try {
    conn = await mysql.createConnection(config);
    const [rows] = await conn.query(
      'SELECT * FROM musicians WHERE musician_name = ? AND musician_family_name = ?',
      [musician_name, musician_family]
    );
    if (rows.length > 0) {
      return res.json({ success: true, musician: rows[0] });
    } else {
      return res.json({ success: false, error: 'No musician found' });
    }
  } catch (err) {
    console.error('/search-musician error:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Database error' });
  } finally {
    if (conn) await conn.end();
  }
});

// Endpoint to save musician biography and picture
// Save musician biography and picture with correct field names and upsert logic
app.post('/save-musician-biography', upload.single('picture'), async (req, res) => {
  const name = (req.body.name || '').trim();
  const musician_biography = (req.body.biography || '').trim();
  const musician_picture = req.file ? req.file.filename : null;
  if (!name || !musician_biography) {
    return res.json({ success: false, error: 'Name and biography are required.' });
  }
  // Split name into musician_name and musician_family_name
  const parts = name.split(' ');
  if (parts.length < 2) {
    return res.json({ success: false, error: 'Please provide both name and family name' });
  }
  const musician_family = parts.pop();
  const musician_name = parts.join(' ');
  let conn;
  try {
    conn = await mysql.createConnection(config);
    // Find musician_id
    const [rows] = await conn.query(
      'SELECT musician_id FROM musicians WHERE musician_name = ? AND musician_family_name = ?',
      [musician_name, musician_family]
    );
    if (rows.length === 0) {
      return res.json({ success: false, error: 'Musician not found.' });
    }
    const musician_id = rows[0].musician_id;
    // Check if biography record exists for this musician_id
    const [bioRows] = await conn.query(
      'SELECT musician_id FROM biography WHERE musician_id = ?',
      [musician_id]
    );
    if (bioRows.length > 0) {
      // Update existing record
      await conn.query(
        'UPDATE biography SET musician_picture = ?, musician_biography = ? WHERE musician_id = ?',
        [musician_picture, musician_biography, musician_id]
      );
    } else {
      // Insert new record
      await conn.query(
        'INSERT INTO biography (musician_id, musician_picture, musician_biography) VALUES (?, ?, ?)',
        [musician_id, musician_picture, musician_biography]
      );
    }
    res.json({ success: true });
  } catch (err) {
    // Enhanced error logging for debugging
    console.error('/save-musician-biography error:', err);
    if (err && err.stack) {
      console.error('Stack trace:', err.stack);
    }
    if (conn) {
      try { await conn.end(); } catch (e) { console.error('Error closing connection:', e); }
    }
    res.status(500).json({ success: false, error: err && err.message ? err.message : 'Database error' });
    return;
  }
  finally {
    // Connection already closed in catch block if error
    if (conn) try { await conn.end(); } catch (e) { console.error('Error closing connection:', e); }
  }
});

// Endpoint to get musician biography by musician_id
app.get('/api/biography', async (req, res) => {
  const musician_id = req.query.musician_id;
  if (!musician_id) {
    return res.status(400).json({ error: 'musician_id required' });
  }
  let conn;
  try {
    conn = await mysql.createConnection(config);
    const [rows] = await conn.query(
      'SELECT musician_biography, musician_picture FROM biography WHERE musician_id = ?',
      [musician_id]
    );
    if (rows.length === 0) {
      return res.json({ musician_biography: '', musician_picture: null });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('/api/biography error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (conn) await conn.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Endpoint to get paginated songs for an album
app.get('/api/songs', async (req, res) => {
  const album_id = req.query.album_id;
  const perPage = Math.max(1, Number(req.query.perPage) || 10);
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * perPage;
  if (!album_id) {
    res.status(400).json({ error: 'album_id required' });
    return;
  }
  let conn;
  try {
    conn = await mysql.createConnection(config);
    // Get total count
    const [[{ count }]] = await conn.query('SELECT COUNT(*) AS count FROM songs WHERE album_id = ?', [album_id]);
    // Get paginated songs
    const [rows] = await conn.query(
      'SELECT song_no, song_title, duration FROM songs WHERE album_id = ? ORDER BY song_no LIMIT ? OFFSET ?',
      [album_id, perPage, offset]
    );
    res.json({
      total: Number(count),
      page,
      perPage,
      data: rows,
    });
  } catch (err) {
    console.error('API /api/songs error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (conn) await conn.end();
  }
});

// Endpoint to get paginated musicians for an album
app.get('/api/musicians', async (req, res) => {
  const album_id = req.query.album_id;
  const perPage = Math.max(1, Number(req.query.perPage) || 10);
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * perPage;
  if (!album_id) {
    res.status(400).json({ error: 'album_id required' });
    return;
  }
  let conn;
  try {
    conn = await mysql.createConnection(config);
    // Get total count
    const [[{ count }]] = await conn.query('SELECT COUNT(*) AS count FROM musicians WHERE album_id = ?', [album_id]);
    // Get paginated musicians
    const [rows] = await conn.query(
      'SELECT musician_id, musician_name, musician_family_name, instruments FROM musicians WHERE album_id = ? ORDER BY musician_family_name, musician_name LIMIT ? OFFSET ?',
      [album_id, perPage, offset]
    );
    res.json({
      total: Number(count),
      page,
      perPage,
      data: rows,
    });
  } catch (err) {
    console.error('API /api/musicians error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (conn) await conn.end();
  }
});
