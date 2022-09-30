const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
  }
};

initializeDbAndServer();

//MiddleWare Function
const authenticate = (request, response, next) => {
  let jwtToken;

  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secretMessage", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Converting JSON object
const convertJsonObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistJsonObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//API 1 -> User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
  SELECT *
  FROM user
  WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    // If username not exists
    response.status(400);
    response.send("Invalid user");
  } else {
    // If username exists create JWT token
    const isPassWordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPassWordMatched) {
      //Is password match
      const payload = {
        username: username,
      }; //JWT token
      const jwtToken = jwt.sign(payload, "secretMessage");
      response.send({ jwtToken });
    } else {
      //password not match
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2 -> Return list of all states
app.get("/states/", authenticate, async (request, response) => {
  const getAllStatesQuery = `
    SELECT * 
    FROM state;`;
  const getAllStatesResponse = await db.all(getAllStatesQuery);
  response.send(getAllStatesResponse.map((item) => convertJsonObject(item)));
});

//API 3 -> Returns a states based on state ID
app.get("/states/:stateId/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `
    SELECT *
    FROM state
    WHERE state_id = ${stateId};`;
  const getStateDetailsResponse = await db.get(getStateDetailsQuery);
  response.send(convertJsonObject(getStateDetailsResponse));
});

//API 4 -> Create district in district table
app.post("/districts/", authenticate, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
    INSERT INTO 
        district (district_name, state_id, cases, cured, active, deaths)
    VALUES
        ('${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths});`;
  const createDistrictResponse = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5 -> Returns a district based on district ID
app.get("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictDetailsQuery = `
    SELECT *
    FROM district
    WHERE district_id = ${districtId};`;
  const getDistrictDetailsResponse = await db.all(getDistrictDetailsQuery);
  response.send(
    getDistrictDetailsResponse.map((eachItem) =>
      convertDistJsonObject(eachItem)
    )
  );
});

//API 6 -> Delete district from district table
app.delete(
  "/districts/:districtId/",
  authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
  DELETE 
  FROM district 
  WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7 -> Update details of district based on district ID
app.put("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `
    UPDATE district
    SET
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE district_id = ${districtId};`;
  const updateDistrictResponse = await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

//API 8 -> Returns statistics of specific state
app.get("/states/:stateId/stats/", authenticate, async (request, response) => {
  const { stateId } = request.params;

  const getStatsQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};`;
  const getStatsResponse = await db.all(getStatsQuery);
  response.send(getStatsResponse);
});

module.exports = app;
