import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Joi from 'joi';
import dayjs from 'dayjs';

pg.types.setTypeParser(1082, (str) => str); // altera a função do pg que parseia a data pra não parsear mais, agora recebe uma string e retorna uma string

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
    
    const userSchema = Joi.object({
        name: Joi.string().required(),
    });

    try { 
        const existingName = await connection.query('SELECT * FROM categories WHERE name = $1', [name]);
        const { error, value } = userSchema.validate(name);

        if(existingName.rows.length !== 0){                        
            res.sendStatus(409);
        } else {
            await connection.query("INSERT INTO categories (name) VALUES ($1)", [value]);        
            res.sendStatus(201);
        }
    } catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
});

app.get('/games', async (req, res) => {

    try { 
        const { name } = req.query;
        let filteredName;

        if(name) {
            filteredName = name[0].toUpperCase();   
        } else {
            filteredName = null;
        }              

		const querySettings = filteredName ? `${filteredName}%` : "%";              
		const games = await connection.query(`
        SELECT games.*, categories.name AS "categoryName" 
        FROM games JOIN categories 
        ON games."categoryId" = categories.id
        WHERE games.name 
        LIKE $1`, [querySettings]);                
        console.log(games.rows);
		res.send(games.rows);        
    } catch(e){
        console.log(e)  
        res.sendStatus(500);
    }
});

app.post('/games', async (req, res) => {
    const { name, image, stockTotal, categoryId, pricePerDay } = req.body;

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
        res.sendStatus(500);
    }
});

app.get('/customers', async (req, res) => {
      
    try { 
        const { cpf } = req.query;   
        const querySettings = cpf ? `${cpf}%` : "%";
        const customers = await connection.query("SELECT * FROM customers WHERE cpf LIKE $1", [querySettings]);
        res.send(customers.rows)        
    } catch(e){
        console.log(e)        
    }
});

app.get('/customers/:id', async (req, res) => {
    const id = parseInt(req.params.id); 

    try { 

        const existingId = await connection.query("SELECT * FROM customers WHERE id = $1", [id]);

        if (existingId.rows.length !== 0) {
            const customers = await connection.query("SELECT * FROM customers WHERE id = $1", [id]);
            return res.send(customers.rows)  
        } else {
            return res.sendStatus(404);
        }

    } catch(e){
        console.log(e)  
        res.sendStatus(500);
    }
});

app.post('/customers', async (req, res) => {

    const customersSchema = Joi.object({
        name: Joi.string().required(),    
        phone: Joi.string().pattern(/^[0-9]{10,11}$/).required(),              
        cpf: Joi.string().pattern(/^[0-9]{11}$/).required(), 
        birthday: Joi.date().iso().less('now'),  
    });

    const validation = customersSchema.validate(req.body);

    if(!validation.error) {
        const { name, phone, cpf, birthday } = req.body;        

        try {
            const existentCPF = await connection.query('SELECT * FROM customers WHERE cpf = $1', [cpf]);

            if (existentCPF.rows.length === 0) {
                await connection.query('INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)', [name, phone, cpf, birthday]);
                res.sendStatus(201);
            } else {
                res.sendStatus(409);
            }
            
        } catch (e) {
            console.log(e);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(400);
    }    
});

app.put('/customers/:id', async (req, res) => {

    const id = (req.params.id); 

    const customersSchema = Joi.object({
        name: Joi.string().required(),    
        phone: Joi.string().pattern(/^[0-9]{10,11}$/),              
        cpf: Joi.string().alphanum().length(11).pattern(/^[0-9]{11}$/), 
        birthday: Joi.date().iso().less('now'),  
    });

    const validation = customersSchema.validate(req.body);

    if(!validation.error) {
        const { name, phone, cpf, birthday } = req.body;        

        try {
            const existentCPF = await connection.query('SELECT * FROM customers WHERE cpf = $1', [cpf]);

            if (existentCPF.rows.length === 0) {
                await connection.query('UPDATE customers SET name = $1, phone = $2, cpf = $3, birthday = $4 WHERE id = $5', [name, phone, cpf, birthday, id]);
                res.sendStatus(201);
            } else {
                res.sendStatus(409);
            }
            
        } catch (e) {
            console.log(e);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(400);
    }    
});

app.post('/rentals', async (req, res) => {
   const { customerId, gameId, daysRented } = req.body;   
   const rentDate = dayjs().format('YYYY-MM-DD');
   const returnDate = dayjs().format('YYYY-MM-DD');
   const delayFee = null;
   let getPricePerDay = null;

    try {
        getPricePerDay = await connection.query(`
        SELECT games."pricePerDay", games.id, rentals."gameId"
        FROM games JOIN rentals 
        ON games.id = rentals."gameId"
        WHERE games.id = $1
        `, [gameId]);
    } catch(e) {
        console.log(e);
        return res.sendStatus(500);
    }
   
   const pricePerDay = getPricePerDay.rows[0] ? getPricePerDay.rows[0].pricePerDay : "";
   const originalPrice = daysRented * pricePerDay;
   const validateExistingCustomer = await connection.query('SELECT * FROM customers WHERE id = $1', [customerId]);
   const validateExistingGame = await connection.query('SELECT * FROM games WHERE id = $1', [gameId]); 
   let openRents = null;
   
   try {
        openRents = await connection.query(`
        SELECT rentals."gameId", rentals."returnDate", games."stockTotal"
        FROM rentals JOIN games
        ON games.id = rentals."gameId"
        WHERE games.id = $1 AND rentals."returnDate" is Null
    `, [gameId]);
    } catch (e) {
       console.log(e);
       return res.sendStatus(500);
    }
       
    if (openRents.rows.length > openRents.rows[0].stockTotal) { 
        return res.sendStatus(400);
    } else if (validateExistingCustomer.rows.length !== 0 && validateExistingGame.rows.length !== 0 && daysRented > 0){       
            try {
                const request = await connection.query(`
                INSERT INTO rentals ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee") 
                VALUES ($1, $2, $3, $4, $5, $6, $7)`, [customerId, gameId, rentDate, daysRented, returnDate, originalPrice, delayFee]);
                res.sendStatus(201);
            } catch(e) {
                console.log(e);
                res.sendStatus(500);
            }
        } else {
            res.sendStatus(400);
        }    
});

app.listen(4000, () => console.log("Server rodando na 4000"));