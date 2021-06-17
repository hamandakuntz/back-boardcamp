import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

const connection = new Pool({
    user: 'bootcamp_role',
    password: 'senha_super_hiper_ultra_secreta_do_role_do_bootcamp',
    host: 'localhost',
    port: 5432,
    database: 'boardcamp'
});

const app = express(); 

app.use(cors());
app.use(express.json());

app.get('/categories', async (req, res) => {
    try { 
        const categories = await connection.query("SELECT * FROM categories");
        res.send(categories.rows)
    } catch(e){
        console.log(e)        
    }
});

app.post('/categories', async (req, res) => {
    const { name } = req.body;

    if (name.length === 0){
        return res.sendStatus(400);
    } 
    
    try { 
        const existingName = await connection.query('SELECT * FROM categories WHERE name = $1', [name]);
        
        if(existingName.rows.length !== 0){                        
            res.sendStatus(409);
        } else {
            await connection.query("INSERT INTO categories (name) VALUES ($1)", [name]);        
            res.sendStatus(201);
        }
    } catch(e) {
        console.log(e);
        res.sendStatus(400);
    }
});

app.get('/games', async (req, res) => {
    try { 
        const games = await connection.query("SELECT * FROM games");
        res.send(games.rows)
    } catch(e){
        console.log(e)        
    }
});

app.post('/games', async (req, res) => {
    const { name, image, stockTotal, categoryId, pricePerDay } = req.body;
    console.log(stockTotal)

    try {
        
        if (isNaN(stockTotal) || isNaN(categoryId) || isNaN(pricePerDay)) {
            console.log('erro 1')
            return res.sendStatus(400);
        }

        if(name.length === 0 || stockTotal <= 0 || pricePerDay <= 0) {
            console.log('erro 2')
            return res.sendStatus(400)
        }

        const existentCategory = await connection.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
        const existingName = await connection.query('SELECT * FROM games WHERE name = $1', [name]);

        if(existentCategory.rows.length === 0) {
            console.log('erro 3')
            return res.sendStatus(400);
        } if (existingName.rows.length !== 0) {
            console.log('erro 4')
            return res.sendStatus(409);
        } else {
            await connection.query('INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5)', [name, image, stockTotal, categoryId, pricePerDay]);
            return res.sendStatus(201);            
        }
        
    } catch(e) {
        console.log(e);
        console.log('erro 5')
        res.sendStatus(400);
    }
});

app.listen(4000, () => console.log("Server rodando na 4000"));