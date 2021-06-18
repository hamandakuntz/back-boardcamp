import express from "express";
import cors from "cors";
import pg from "pg";
import Joi from "joi";
import dayjs from "dayjs";

pg.types.setTypeParser(1082, (str) => str); // altera a função do pg que parseia a data pra não parsear mais, agora recebe uma string e retorna uma string

const { Pool } = pg;

const connection = new Pool({
  user: "bootcamp_role",
  password: "senha_super_hiper_ultra_secreta_do_role_do_bootcamp",
  host: "localhost",
  port: 5432,
  database: "boardcamp",
});

const app = express();

app.use(cors());
app.use(express.json());

app.get("/categories", async (req, res) => {
  try {
    const categories = await connection.query("SELECT * FROM categories");
    res.send(categories.rows);
  } catch {
    res.sendStatus(500);
  }
});

app.post("/categories", async (req, res) => {
  const { name } = req.body;

  if (name.length === 0) {
    return res.sendStatus(400);
  }

  const userSchema = Joi.object({
    name: Joi.string().required(),
  });

  try {
    const existingName = await connection.query(
      "SELECT * FROM categories WHERE name = $1",
      [name]
    );
    const { error, value } = userSchema.validate(name);

    if (existingName.rows.length !== 0) {
      res.sendStatus(409);
    } else {
      await connection.query("INSERT INTO categories (name) VALUES ($1)", [
        value,
      ]);
      res.sendStatus(201);
    }
  } catch {   
    res.sendStatus(500);
  }
});

app.get("/games", async (req, res) => {
  try {
    const { name } = req.query;
    let filteredName;

    if (name) {
      filteredName = name[0].toUpperCase();
    } else {
      filteredName = null;
    }

    const querySettings = filteredName ? `${filteredName}%` : "%";
    const games = await connection.query(
      `
        SELECT games.*, categories.name AS "categoryName" 
        FROM games JOIN categories 
        ON games."categoryId" = categories.id
        WHERE games.name 
        LIKE $1`,
      [querySettings]
    );  
    res.send(games.rows);
  } catch (e) {   
    res.sendStatus(500);
  }
});

app.post("/games", async (req, res) => {
  const { name, image, stockTotal, categoryId, pricePerDay } = req.body;

  try {
    if (isNaN(stockTotal) || isNaN(categoryId) || isNaN(pricePerDay)) {     
      return res.sendStatus(400);
    }

    if (name.length === 0 || stockTotal <= 0 || pricePerDay <= 0) {     
      return res.sendStatus(400);
    }

    const existentCategory = await connection.query(
      "SELECT * FROM categories WHERE id = $1",
      [categoryId]
    );
    const existingName = await connection.query(
      "SELECT * FROM games WHERE name = $1",
      [name]
    );

    if (existentCategory.rows.length === 0) {      
      return res.sendStatus(400);
    }
    if (existingName.rows.length !== 0) {      
      return res.sendStatus(409);
    } else {
      await connection.query(
        'INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5)',
        [name, image, stockTotal, categoryId, pricePerDay]
      );
      return res.sendStatus(201);
    }
  } catch {    
    res.sendStatus(500);
  }
});

app.get("/customers", async (req, res) => {
  try {
    const { cpf } = req.query;
    const querySettings = cpf ? `${cpf}%` : "%";
    const customers = await connection.query(
      "SELECT * FROM customers WHERE cpf LIKE $1",
      [querySettings]
    );
    res.send(customers.rows);
  } catch (e) {
    res.sendStatus(404);
  }
});

app.get("/customers/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const existingId = await connection.query(
      "SELECT * FROM customers WHERE id = $1",
      [id]
    );

    if (existingId.rows.length !== 0) {
      const customers = await connection.query(
        "SELECT * FROM customers WHERE id = $1",
        [id]
      );
      return res.send(customers.rows[0]);
    } else {
      return res.sendStatus(404);
    }
  } catch {
    res.sendStatus(500);
  }
});

app.post("/customers", async (req, res) => {
  const customersSchema = Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().pattern(/^[0-9]{10,11}$/),
    cpf: Joi.string().pattern(/^[0-9]{11}$/),
    birthday: Joi.date().iso().less("now"),
  });

  const validation = customersSchema.validate(req.body);

  if (!validation.error) {
    const { name, phone, cpf, birthday } = req.body;

    try {
      const existentCPF = await connection.query(
        "SELECT * FROM customers WHERE cpf = $1",
        [cpf]
      );

      if (existentCPF.rows.length === 0) {
        await connection.query(
          "INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)",
          [name, phone, cpf, birthday]
        );
        res.sendStatus(201);
      } else {
        res.sendStatus(409);
      }
    } catch {     
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(400);
  }
});

app.put("/customers/:id", async (req, res) => {
  const id = req.params.id;

  const customersSchema = Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().pattern(/^[0-9]{10,11}$/),
    cpf: Joi.string().pattern(/^[0-9]{11}$/),
    birthday: Joi.date().iso().less("now"),
  });

  const validation = customersSchema.validate(req.body);

  if (!validation.error) {
    const { name, phone, cpf, birthday } = req.body;

    try {
      const existentCPF = await connection.query(
        "SELECT * FROM customers WHERE cpf LIKE $1 AND id <> $2",
        [cpf, id]
      );

      if (existentCPF.rows.length !== 0) {
        return res.sendStatus(409);
      } else {
        const response = await connection.query(
          "UPDATE customers SET name = $1, phone = $2, cpf = $3, birthday = $4 WHERE id = $5",
          [name, phone, cpf, birthday, id]
        );
        res.sendStatus(201);        
      }
    } catch {
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(400);
  }
});

app.get("/rentals", async (req, res) => {
  const { customerId, gameId } = req.query;
  const validateExistingQueryParam = !!customerId || !!gameId;
  let constructedQuery = "";
  let queryArguments = [];

  if (validateExistingQueryParam) {
    if (customerId && gameId) {
      constructedQuery = `WHERE rentals."gameId" = $1 AND rentals."customerId" = $2`;
      queryArguments = [gameId, customerId];
    } else if (customerId) {
      constructedQuery = `WHERE rentals."customerId" = $1`;
      queryArguments = [customerId];
    } else {
      constructedQuery = `WHERE rentals."gameId" = $1`;
      queryArguments = [gameId];
    }
  }

  try {
    const info = await connection.query(
      `
        SELECT rentals.* , customers.name AS "customerName", 
        games.name AS "gameName", games."categoryId", 
        categories.name AS "categoryName"
        FROM 
        rentals JOIN customers 
        ON customers.id = rentals."customerId"        
        JOIN games 
        ON rentals."gameId" = games.id   
        JOIN categories  
        ON games."categoryId" = categories.id 
        ${constructedQuery} 
        `,
      queryArguments
    );

    
    const info2 = info.rows.map((i) => {
      return {
        id: i.id,
        customerId: i.customerId,
        gameId: i.gameId,
        rentDate: i.rentDate,
        daysRented: i.daysRented,
        returnDate: i.returnDate,
        originalPrice: i.originalPrice,
        delayFee: i.delayFee,
        customer: {
          id: i.customerId,
          name: i.customerName,
        },
        game: {
          id: i.gameId,
          name: i.gameName,
          categoryId: i.categoryId,
          categoryName: i.categoryName,
        },
      };
    });

    res.send(info2);
  } catch {    
    res.sendStatus(500);
  }
});

app.post("/rentals", async (req, res) => {
  const { customerId, gameId, daysRented } = req.body;
  const rentDate = dayjs().format("YYYY-MM-DD");
  const returnDate = null;
  const delayFee = null;

  let pricePerDay = await connection.query(`SELECT "pricePerDay" FROM games WHERE id=$1`, [gameId]);
  pricePerDay = pricePerDay.rows[0].pricePerDay;

  const originalPrice = daysRented * pricePerDay; 

  const validateExistingCustomer = await connection.query(
    "SELECT * FROM customers WHERE id = $1",
    [customerId]
  );
  const validateExistingGame = await connection.query(
    "SELECT * FROM games WHERE id = $1",
    [gameId]
  );
  let openRents = null;

  try {
    openRents = await connection.query(
      `
        SELECT rentals."gameId", rentals."returnDate", games."stockTotal"
        FROM rentals JOIN games
        ON games.id = rentals."gameId"
        WHERE games.id = $1 AND rentals."returnDate" is Null
    `,
      [gameId]
    );
  } catch {   
    return res.sendStatus(500);
  }

  if (openRents.rows.length >= openRents.rows[0]?.stockTotal) {
    return res.sendStatus(400);
  } else if (
    validateExistingCustomer.rows.length !== 0 &&
    validateExistingGame.rows.length !== 0 &&
    daysRented > 0
  ) {
    try {
      const request = await connection.query(
        `
                INSERT INTO rentals ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee") 
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          customerId,
          gameId,
          rentDate,
          daysRented,
          returnDate,
          originalPrice,
          delayFee,
        ]
      );
      res.sendStatus(201);
    } catch  {     
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(400);
  }
});

app.post("/rentals/:id/return", async (req, res) => {
  const id = req.params.id;

  
  const rent = await connection.query(
    `
    SELECT * FROM rentals WHERE id = $1    
    `,
    [id]
  );

  const validateExistingRentalId = rent.rows[0];

  if (!validateExistingRentalId) {
    return res.sendStatus(404);
  }

  const gamePrice = await connection.query(
    `
      SELECT "pricePerDay" FROM games WHERE id = $1`,
    [rent.rows[0].gameId]
  );

 
  try {
    if (!rent.rows[0]) {
      return res.sendStatus(404);
    }

    if (rent.rows[0].returnDate !== null) {
      return res.sendStatus(400);
    }

    const returnDate = dayjs();
    const daysRented = rent.rows[0].daysRented;
    const totalPrice = gamePrice.rows[0].pricePerDay;
    const rentDate = rent.rows[0].rentDate;
  
    let calculateDays = (returnDate.diff(rentDate, 'day') - daysRented);
    let delayFee = null;
    
    if(calculateDays <= 0 ) {
        delayFee = null;
    } else {
        delayFee = calculateDays * totalPrice;
    }
         
    await connection.query(
      `UPDATE rentals SET "returnDate" = $1, "delayFee" = $2 WHERE id = $3`,
      [returnDate, delayFee, id]
    );

    await connection.query(
      `UPDATE games SET "stockTotal" = "stockTotal" + 1 WHERE id = $1`,
      [rent.rows[0].gameId]
    );

    res.sendStatus(200);
  } catch {   
    res.sendStatus(500);
  }
});

app.delete("/rentals/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const validateExistingRent = await connection.query(
            `
            SELECT * FROM rentals WHERE id = $1    
            `,
            [id]
        ); 

        if(!validateExistingRent.rows[0]) {
            return res.sendStatus(404)
        }

        if (validateExistingRent.rows[0].returnDate !== null) {
            return res.sendStatus(400)
        } else {
            await connection.query("DELETE FROM rentals WHERE id=$1", [id]);
		    return res.sendStatus(200)
        }
        
    } catch {      
      res.sendStatus(500);
    }
});


app.get("/rentals/metrics", async (req, res) => {
  let revenue = null;
  let rentals = null;
  let average = null;

  try {
    rentals = await connection.query(`
    SELECT count(id) FROM rentals    
    `)      
  } catch {
    res.sendStatus(500);
  }
});


app.listen(4000);
