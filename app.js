const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19India.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//converting states_name to stateName
const convertingJsonToDb = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertingJsonDistrict = (distObj) => {
  return {
    districtId: distObj.district_id,
    districtName: distObj.district_name,
    stateId: distObj.state_id,
    cases: distObj.cases,
    cured: distObj.cured,
    active: distObj.active,
    deaths: distObj.deaths,
  };
};

//API 1 Return list of states in state table
app.get("/states/", async (request, response) => {
  const getStatesQuery = `
    SELECT *
    FROM state;`;
  const getStatesResponse = await db.all(getStatesQuery);
  response.send(
    getStatesResponse.map((eachItem) => convertingJsonToDb(eachItem))
  );
});

//API 2 Return a state based on state ID
app.get("/states/:stateId/", async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `
    SELECT *
    FROM state
    WHERE state_id = ${stateId};`;
  const getStateDetailsResponse = await db.all(getStateDetailsQuery);
  response.send(
    getStateDetailsResponse.map((eachItem) => convertingJsonToDb(eachItem))
  );
});

//API 3 Create a district in district table, district_id auto_incremented
app.post("/districts/", async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
    INSERT INTO 
        district(district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const createDistrictResponse = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 4 Return a district based on district ID
app.get("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const getDistrictByIdQuery = `
    SELECT *
    FROM district
    WHERE district_id = ${districtId};`;
  const getDistrictByIdResponse = await db.all(getDistrictByIdQuery);
  response.send(convertingJsonDistrict(getDistrictByIdResponse));
});

//API 5 Delete a district from district table
app.delete("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictQuery = `
    DELETE 
    FROM district
    WHERE district_id = ${districtId};`;
  const deleteDistrictResponse = await db.get(deleteDistrictQuery);
  response.send("District Removed");
});

//API 6 Updates the details of specific district based on district ID
app.put("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `
    UPDATE district SET 
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

//API 7 Returns statistics of total cases, cured, active, deaths of specific state based on stateID
app.get("/states/:stateId/stats/", async (request, response) => {
  const { stateId } = request.params;
  const getStateIdQuery = `
    SELECT
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};`;
  const getStateIdResponse = await db.get(getStateIdQuery);
  response.send(getStateIdResponse);
});

//API 8 Return object containing state name of district based on district ID
app.get("/districts/:districtId/details/", async (request, response) => {
  const { districtId } = request.params;

  //getting state_id from district table and appending to state table
  const getDistrictIdQuery = `
  SELECT state_id
  FROM district;
  WHERE district_id = ${districtId};`;
  const getDistrictResponse = await db.get(getDistrictIdQuery);

  //getting state_id from District ID Response
  const getStatesNameQuery = `
    SELECT state_name AS stateName
    FROM state
    WHERE state_id = ${getDistrictResponse.state_id}`;
  const getStatesResponse = await db.get(getStatesNameQuery);
  response.send(getStatesResponse);
});

module.exports = app;
