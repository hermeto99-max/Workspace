require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
	const config = {
		host: process.env.MYSQL_HOST || 'localhost',
		user: process.env.MYSQL_USER || 'admin',
		password: process.env.MYSQL_PASSWORD || 'Crkva505@1',
		database: process.env.MYSQL_DATABASE || 'Media',
		port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
	};

	let conn;
	try {
		conn = await mysql.createConnection(config);
		console.log('Connected to MySQL:', `${config.user}@${config.host}:${config.port}/${config.database}`);
		const [nowRows] = await conn.query('SELECT NOW() AS now');
		console.log('Server time:', nowRows[0].now);

		// Fetch all albums
		try {
			const [albums] = await conn.query('SELECT * FROM albums');
			console.log(`Fetched ${Array.isArray(albums) ? albums.length : 0} rows from albums.`);
			if (Array.isArray(albums)) console.table(albums);
		} catch (qerr) {
			console.error('Query error (albums):', qerr.message || qerr);
		}
	} catch (err) {
		console.error('MySQL connection error:', err.message || err);
		process.exitCode = 1;
	} finally {
		if (conn) await conn.end();
	}
}

if (require.main === module) main();


