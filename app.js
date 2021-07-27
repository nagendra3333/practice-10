const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      fileName: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertState = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrict = (dbObject) => {
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

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authentication"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "sss", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("INvalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUser);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (isPasswordValid === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "sss");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const selectQuery = `
        SELECT
          *
        FROM
          state`;
  const statesArray = await db.all(selectQuery);
  response.send(statesArray.map((eachState) => convertState(eachState)));
});

app.get("/states/:statesId", authenticateToken, async (request, response) => {
  const { stateId } = response.params;
  const getStatesQuery = `
        SELECT
          *
        FROM
          state
        WHERE
          state_id =  ${stateId}`;
  const statesArray = await db.get(getStatesQuery);
  response.send(convertState(statesArray));
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT
          *
        FROM
          district
        WHERE
          district_id = ${districtId}`;
    const district = await db.get(getDistrictQuery);
    response.send(convertDistrict(district));
  }
);

app.post("/districts/", authenticateToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const postQuery = `
        INSERT INTO
            district (state_id, district_name, cases, cured, active, deaths)
        VALUES
            (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths})`;
  await db.run(postQuery);
  response.send("District Successfully Added");
});

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
        DELETE FROM 
            district
        WHERE
            district_id = ${districtId}`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
        UPDATE
          district
        SET
          district_name = '${districtName}',
          state_id = ${stateId},
          cases = ${cases},
          cured = ${cured},
          active = ${active},
          deaths = ${deaths},
        WHERE 
          district_id = ${districtId}`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/stated/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
        SELECT
          SUM(cases),
          SUM(cured),
          SUM(active),
          SUM(deaths)
        FROM
          district
        WHERE
          state_id = ${stateId}`;
    const stats = await db.get(getStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
