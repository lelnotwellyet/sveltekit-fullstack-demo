import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { createPool, type VercelPool } from '@vercel/postgres';
import { POSTGRES_URL } from '$env/static/private';

let db: VercelPool;

export async function load() {
  db = createPool({ connectionString: POSTGRES_URL });

  try {
    const { rows: names } = await db.query('SELECT * FROM names');
    return {
      names: names,
    };
  } catch (err) {
    console.log('Table does not exist, creating and seeding it with dummy data now...');
    await seed();
    const { rows: names } = await db.query('SELECT * FROM names');
    return {
      names: names
    };
  }
}

async function seed() {
  const client = await db.connect();

  try {
    await client.sql`
      CREATE TABLE IF NOT EXISTS names (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('Created "names" table');

    const users = await Promise.all([
      client.sql`
        INSERT INTO names (name, email)
        VALUES ('Rohan', 'rohan@tcl.com')
        ON CONFLICT (email) DO NOTHING;
      `,
      client.sql`
        INSERT INTO names (name, email)
        VALUES ('Rebecca', 'rebecca@tcl.com')
        ON CONFLICT (email) DO NOTHING;
      `,
      client.sql`
        INSERT INTO names (name, email)
        VALUES ('Vivek', 'vivek@gmail.com')
        ON CONFLICT (email) DO NOTHING;
      `,
    ]);

    console.log(`Seeded ${users.length} users`);
  } finally {
    client.release();
  }
}

export const actions = {
  update: async ({ request }: RequestEvent) => {
    const data = await request.formData();
    const client = await db.connect();

    try {
      const email = data.get('new_email');
      const name = data.get('update_name');
      const id = data.get('id');

      const emailValue = email instanceof File ? email.name : email?.toString() ?? null;
      const nameValue = name instanceof File ? name.name : name?.toString() ?? null;
      const idValue = id instanceof File ? id.name : id?.toString();

      if (!idValue) {
        throw error(400, 'ID is required for update operation');
      }

      await client.sql`
        UPDATE names
        SET 
          email = COALESCE(${emailValue}, email),
          name = COALESCE(${nameValue}, name)
        WHERE id = ${idValue};
      `;
      return { emailUpdated: true };
    } catch (err) {
      console.error('Error updating email:', err);
      throw error(500, 'Failed to update email');
    } finally {
      client.release();
    }
  },

  delete: async ({ request }: RequestEvent) => {
    const data = await request.formData();
    const client = await db.connect();

    try {
      const id = data.get('id');
      const idValue = id instanceof File ? id.name : id?.toString();

      if (!idValue) {
        throw error(400, 'ID is required for delete operation');
      }

      await client.sql`
        DELETE FROM names
        WHERE id = ${idValue};
      `;

      return { success: true };
    } catch (err) {
      console.error('Error deleting user:', err);
      throw error(500, 'Failed to delete user');
    } finally {
      client.release();
    }
  },

  create: async ({ request }: RequestEvent) => {
    const data = await request.formData();
    const client = await db.connect();

    try {
      const email = data.get('email');
      const name = data.get('name');

      const emailValue = email instanceof File ? email.name : email?.toString();
      const nameValue = name instanceof File ? name.name : name?.toString();

      if (!emailValue || !nameValue) {
        throw error(400, 'Email and name are required for create operation');
      }

      await client.sql`
        INSERT INTO names (name, email)
        VALUES (${nameValue}, ${emailValue})
        ON CONFLICT (email) DO NOTHING;
      `;

      return { success: true };
    } catch (err) {
      console.error('Error creating user:', err);
      throw error(500, 'Failed to create user');
    } finally {
      client.release();
    }
  }
};