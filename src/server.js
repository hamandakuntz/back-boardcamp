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
        const validateName = await connection.query("SELECT * FROM categories WHERE name = $1", [name]);
        if(validateName){
            return res.sendStatus(409);
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

});

app.post('/games', async (req, res) => {
    const { name, image, stockTotal, categoryId, pricePerDay } = req.body;
    console.log(stockTotal)

    try {
        
        if (isNaN(stockTotal) || isNaN(categoryId) || isNaN(pricePerDay)) {
            return res.sendStatus(400);
        }

        if(name.length === 0 || stockTotal <= 0 || pricePerDay <= 0) {
            return res.sendStatus(400)
        }

        const validateCategory = await connection.query('SELECT * FROM categories WHERE categoryId = $1", [categoryId]');

        if(validateCategory) {
            const game = await connection.query('INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5)', [name, image, stockTotal, categoryId, pricePerDay]);
            res.sendStatus(201);
        } else {
            res.sendStatus(400);
        }
        
    } catch(e) {
        console.log(e);
        res.sendStatus(400);
    }
});

app.listen(4000, () => console.log("Server rodando na 4000"));