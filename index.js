/* eslint-disable no-useless-return */
import express from 'express';
import pg from 'pg';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';
import jsSHA from 'jssha';
import moment from 'moment';
import multer from 'multer';
import aws from 'aws-sdk';
import multerS3 from 'multer-s3';

// pg setup
let pgConnectionconfigs;
if (process.env.DATABASE_URL) {
  pgConnectionconfigs = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  };
} else {
  pgConnectionconfigs = {
    user: 'postgres',
    host: 'localhost',
    password: 'password',
    database: 'tna',
    port: 5432,
  };
}

const PORT = process.env.PORT || 3004;
const { Pool } = pg;
const pool = new Pool(pgConnectionconfigs);
pool.connect();

// configure s3
const s3 = new aws.S3({
  accessKeyId: process.env.ACCESSKEYID,
  secretAccessKey: process.env.SECRETACCESSKEY,
});

// multer setup
const multerUpload = multer({
  storage: multerS3({
    s3,
    bucket: '<MY_BUCKET_NAME>',
    acl: 'public-read',
    metadata: (request, file, callback) => {
      callback(null, { fieldName: file.fieldname });
    },
    key: (request, file, callback) => {
      callback(null, Date.now().toString());
    },
  }),
});

// express setup
const app = express();
app.set('view engine', 'ejs');
app.use(methodOverride('_method'));
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('uploads'));
// check if user is the manager of the evaluation form
app.use('/evaluationForm/:evaluationId', (req, res, next) => {
  req.isManager = false;
  const { evaluationId } = req.params;
  const { userId } = req.cookies;
  pool.query(`SELECT manager_id FROM employees INNER JOIN evaluations ON evaluations.employee_id = employees.id WHERE evaluations.id = ${evaluationId}`)
    .then((result) => {
      const managerId = result.rows[0].manager_id;
      if (managerId === Number(userId)) {
        req.isManager = true;
      }
    })
    .then(() => {
      next();
    });
});

const SALT = 'secret';

// render sign up page
app.get('/signup', (req, res) => {
  const { loggedIn } = req.cookies;
  let jobCategories;
  let jobs;
  // get all job categories
  pool.query('SELECT * FROM job_categories')
    .then((result) => {
      jobCategories = result.rows;
      // get all job titles
      return pool.query('SELECT * FROM job_titles');
    })
    .then((result) => {
      jobs = result.rows;
      return pool.query('SELECT name, id FROM employees');
    })
    .then((result) => {
      const managers = result.rows;
      res.render('signup', {
        jobCategories, jobs, managers, loggedIn,
      });
    });
});

// insert new signup info into employees table
app.post('/signup', (req, res) => {
  const {
    name, email, password, jobId, managerId,
  } = req.body;
  // initializing new SHA object
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  shaObj.update(password);
  const hashedPassword = shaObj.getHash('HEX');
  const values = [name, email, jobId, hashedPassword, managerId];
  pool.query('INSERT INTO employees (name, email, job_title_id, password, manager_id) VALUES ($1,$2,$3,$4, $5)', values)
    .then(() => {
      res.redirect('/login');
    });
});

// render login page
app.get('/login', (req, res) => {
  const { loggedIn } = req.cookies;
  res.render('login', { loggedIn });
});

// verify user to allow them to login
app.post('/login', (req, res) => {
  const { hr } = req.body;
  // clear any existing cookies
  res.clearCookie('loggedInHash');
  res.clearCookie('userId');
  let user;
  const { email, password } = req.body;
  // get hashed password from employees table
  pool.query(`SELECT id, password FROM employees WHERE email='${email}'`)
    .then((result) => {
      user = result.rows[0];
    })
    .then(() => {
      const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
      shaObj.update(password);
      const hashedPassword = shaObj.getHash('HEX');
      // check if password in DB is same as password in the form
      if (user.password !== hashedPassword) {
        res.status(403).send('login failed');
        return;
      }
      // create a hashed cookie
      const shaObj2 = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
      shaObj2.update(`${user.id}-${SALT}`);
      const hashedCookieString = shaObj2.getHash('HEX');
      res.cookie('loggedInHash', hashedCookieString);
      res.cookie('loggedIn', true);
      res.cookie('userId', user.id);
      if (hr === 'hr') {
        res.redirect('hr');
      } else {
        res.redirect('/action');
      }
    })
    .catch((err) => {
      res.status(404).send('Unable to login. Please try again!');
    });
});

app.get('/logout', (req, res) => {
  res.clearCookie('loggedInHash');
  res.clearCookie('loggedIn');
  res.clearCookie('userId');
  res.clearCookie('evaluationId');
  res.redirect('/login');
});

app.get('/hr', (req, res) => {
  const { loggedIn } = req.cookies;
  const { sortBy, filter } = req.query;
  let evaluations;
  let distinctEmployees;
  // query information on all evaluations
  pool.query('SELECT DISTINCT employees.name, employees.id FROM employees INNER JOIN evaluations ON employees.id = evaluations.employee_id')
    .then((result) => {
      distinctEmployees = result.rows;
      return pool.query('SELECT employees.name, job_titles.job_title, evaluations.id as evaluationId, employees.id as employeeId, evaluations.status, evaluations.date FROM evaluations INNER JOIN employees ON employees.id = evaluations.employee_id INNER JOIN job_titles ON employees.job_title_id = job_titles.id');
    })
    .then((result) => {
      evaluations = result.rows;

      // sort alphabetically
      function sortAlphabetically(a, b) {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        if (nameA < nameB) {
          return -1;
        }
        if (nameA > nameB) {
          return 1;
        }
        return 0;
      }

      // sort alphabetically
      function sortReverseAlphabetically(a, b) {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        if (nameA < nameB) {
          return 1;
        }
        if (nameA > nameB) {
          return -1;
        }
        return 0;
      }

      // oldest to latest
      function sortByReverseDate(a, b) {
        const dateA = moment(a.date, 'DD-MM-YYYY');
        const dateB = moment(b.date, 'DD-MM-YYYY');
        if (dateA < dateB) {
          return -1;
        }
        if (dateA > dateB) {
          return 1;
        }
        return 0;
      }

      // oldest to latest
      function sortByDate(a, b) {
        const dateA = moment(a.date, 'DD-MM-YYYY');
        const dateB = moment(b.date, 'DD-MM-YYYY');
        if (dateA < dateB) {
          return 1;
        }
        if (dateA > dateB) {
          return -1;
        }
        return 0;
      }

      if (sortBy === 'alphabetical') {
        evaluations.sort(sortAlphabetically);
      } else if (sortBy === 'reverse-alphabetical') {
        evaluations.sort(sortReverseAlphabetically);
      } else if (sortBy === 'reverse-date') {
        evaluations.sort(sortByReverseDate);
      } else if (sortBy === 'date') {
        evaluations.sort(sortByDate);
      }
      if (filter !== undefined) {
        evaluations = evaluations.filter((evaluation) => evaluation.employeeid === Number(filter));
      }
    })
    .then(() => {
      res.render('hr', {
        loggedIn, evaluations, moment, distinctEmployees,
      });
    });
});

// page to show either verify evaluation or submit new evaluation (after log in)
app.get('/action', (req, res) => {
  const { loggedIn } = req.cookies;
  res.render('action', { loggedIn });
});

// page with all the evaluations for an employee
app.get('/evaluations', (req, res) => {
  const { userId, loggedIn } = req.cookies;
  // check if user is a manager
  pool.query(`SELECT * FROM employees WHERE manager_id=${userId}`)
    .then((result) => {

    });
  pool.query(`SELECT * FROM  evaluations WHERE employee_id = ${userId}`)
    .then((result) => {
      const evaluations = result.rows;
      res.render('evaluations', { evaluations, loggedIn, moment });
    });
});

// add new evaluation
app.post('/evaluations', (req, res) => {
  const { userId } = req.cookies;
  // add new evaluation into evaluations table
  pool.query(`INSERT INTO evaluations (employee_id) VALUES (${userId})`)
  // get the id of the newest evaluation for the user
    .then(() => pool.query(`SELECT id FROM evaluations WHERE employee_id=${userId}`))
    .then((result) => {
      const evaluationId = result.rows[result.rows.length - 1].id;
      res.redirect(`/evaluationForm/${evaluationId}`);
    });
});

app.get('/verifyEvaluations', (req, res) => {
  const { userId, loggedIn } = req.cookies;
  pool.query(`SELECT * FROM employees INNER JOIN evaluations ON employees.id = evaluations.employee_id WHERE employees.manager_id = ${userId} AND (evaluations.status = 'pending approval' OR evaluations.status = 'approved')`)
    .then((result) => {
      const evaluations = result.rows;
      res.render('verifyEvaluations', { evaluations, loggedIn, moment });
    });
});

// employee evaluation form
app.get('/evaluationForm/:evaluationId', (req, res) => {
  const { loggedIn } = req.cookies;
  const { evaluationId } = req.params;
  const { isManager } = req;
  let jobInfo;
  let requirements;
  let competencies;
  let name;
  let status;
  // get user's name
  pool.query(`SELECT name from employees INNER JOIN evaluations ON evaluations.employee_id = employees.id WHERE evaluations.id=${evaluationId}`)
  // get job_title_id of the evaluation form
    .then((result) => {
      name = result.rows[0].name;
      return pool.query(`SELECT job_title_id, job_title FROM employees INNER JOIN evaluations ON evaluations.employee_id = employees.id INNER JOIN job_titles on employees.job_title_id = job_titles.id WHERE evaluations.id = ${evaluationId}`);
    })
    .then((result) => {
      jobInfo = result.rows[0];
      // get all required competencies for the user's job
      return pool.query(`SELECT general_levels.level, general_levels.description, general_competencies.competency FROM general_levels INNER JOIN general_job_requirement ON general_job_requirement.general_levels_id = general_levels.id INNER JOIN general_competencies ON general_competencies.id = general_levels.general_competency_id WHERE general_job_requirement.job_title_id = ${jobInfo.job_title_id}`);
    })
    .then((result) => {
      requirements = result.rows;
      return pool.query(`SELECT employee_competencies.manager_level_id, employee_competencies.manager_comment, employee_competencies.general_competencies_id, employee_competencies.general_levels_id, employee_competencies.action_plan, general_competencies.competency, general_levels.level FROM employee_competencies INNER JOIN general_levels ON employee_competencies.general_levels_id = general_levels.id INNER JOIN general_competencies ON general_levels.general_competency_id = general_competencies.id WHERE employee_competencies.evaluations_id = ${evaluationId}`);
    })
    .then((result) => {
      competencies = result.rows;
    })
    .then(() =>
      // check status of form
      pool.query(`SELECT status FROM evaluations WHERE id=${evaluationId}`))
    .then((result) => {
      status = result.rows[0].status;
    })
    .then((result) =>
    // get manager input
      pool.query(`SELECT employee_competencies.manager_level_id, employee_competencies.manager_comment, general_levels.level FROM employee_competencies INNER JOIN general_levels ON employee_competencies.manager_level_id = general_levels.id WHERE employee_competencies.evaluations_id = ${evaluationId}`))
    .then((result) => {
      const managerInput = result.rows;
      console.log('competencies', competencies);
      console.log('manager', managerInput);
      res.render('evaluationForm', {
        requirements, jobInfo, evaluationId, competencies, status, isManager, name, managerInput, loggedIn,
      });
    });
});

app.put('/evaluationForm/:evaluationId', (req, res) => {
  const { evaluationId } = req.params;
  const { isManager } = req;
  if (isManager) {
    pool.query(`UPDATE evaluations SET status='approved' WHERE id=${evaluationId}`)
      .then(() => {
        res.redirect(`/evaluationForm/${evaluationId}`);
      });
  } else {
    pool.query(`UPDATE evaluations SET status='pending approval' WHERE id=${evaluationId}`)
      .then(() => {
        res.redirect(`/evaluationForm/${evaluationId}`);
      });
  }
});

// list the 2 competency categories
app.get('/evaluationForm/:evaluationId/competencyCategories', (req, res) => {
  const { loggedIn } = req.cookies;
  const { evaluationId } = req.params;
  res.render('competencyCategories', { evaluationId, loggedIn });
});

// page with required competencies for specific job and list of competencies for a chosen category
app.get('/evaluationForm/:evaluationId/:category/competencies', (req, res) => {
  const { userId, loggedIn } = req.cookies;
  const { category, evaluationId } = req.params;
  let requiredCompetencies = {};
  // get id of job title
  pool.query(`SELECT job_title_id from employees WHERE id = ${userId}`)
    .then((result) => {
      // get job requirement
      const { job_title_id } = result.rows[0];
      return pool.query(`SELECT ${category}_levels.level, ${category}_levels.description, ${category}_competencies.competency, ${category}_competencies.description FROM ${category}_levels INNER JOIN ${category}_job_requirement ON ${category}_job_requirement.${category}_levels_id = ${category}_levels.id INNER JOIN ${category}_competencies ON ${category}_competencies.id = ${category}_levels.${category}_competency_id WHERE ${category}_job_requirement.job_title_id = ${job_title_id}`);
    })
    .then((result) => {
      requiredCompetencies = result.rows;
    })
    // get all competencies for selected category
    .then(() => pool.query(`SELECT * FROM ${category}_competencies`))
    .then((result) => {
      const categoryCompetencies = result.rows;
      res.render('competencies', {
        requiredCompetencies, categoryCompetencies, category, evaluationId, loggedIn,
      });
    });
});

// list out the levels of a specific competency and highlight the required competency (if there is)
app.get('/evaluationForm/:evaluationId/:category/competencies/:competencyId', (req, res) => {
  const { userId, loggedIn } = req.cookies;
  const { evaluationId, competencyId, category } = req.params;
  let competency = {};
  let requirements;
  // get competency name
  pool.query(`SELECT competency FROM ${category}_competencies WHERE id = ${competencyId}`)
    .then((result) => {
      competency = result.rows[0];
    })
    .then(() =>
    // get all 3 levels for the selected competency
      pool.query(`SELECT ${category}_levels.level, ${category}_levels.id, ${category}_levels.description, ${category}_competencies.competency FROM ${category}_levels INNER JOIN ${category}_competencies ON ${category}_competencies.id = ${category}_levels.${category}_competency_id WHERE ${category}_competencies.id = ${competencyId}`))
    .then((result) => {
      competency.info = result.rows;
    })
    // get job title id
    .then(() => pool.query(`SELECT job_title_id from employees WHERE id = '${userId}'`))
    .then((result) => {
      const { job_title_id } = result.rows[0];
      return pool.query(`SELECT general_levels.level, general_levels.description, general_competencies.competency, general_competencies.description FROM general_levels INNER JOIN general_job_requirement ON general_job_requirement.general_levels_id = general_levels.id INNER JOIN general_competencies ON general_competencies.id = general_levels.general_competency_id WHERE general_job_requirement.job_title_id = ${job_title_id}`);
    })
    .then((result) => {
      requirements = result.rows;
    })
    .then(() =>
      // get level chosen and action of the selection for the specific competency
      pool.query(`SELECT * from employee_competencies WHERE evaluations_id = ${evaluationId} and general_competencies_id = ${competencyId}`))
    .then((result) => {
      const employeeCompetencies = result.rows[0];
      res.render('competencySelection', {
        competency, requirements, evaluationId, category, competencyId, employeeCompetencies, loggedIn,
      });
    });
});

app.delete('/evaluationForm/:evaluationId/:category/competencies/:competencyId', (req, res) => {
  const { evaluationId, competencyId, category } = req.params;
  pool.query(`DELETE FROM employee_competencies WHERE evaluations_id = ${evaluationId} AND general_competencies_id=${competencyId}`)
    .then(() => {
      res.redirect(`/evaluationForm/${evaluationId}`);
    });
});

// edit page for competency selection
app.get('/evaluationForm/:evaluationId/:category/competencies/:competencyId/edit', (req, res) => {
  const { isManager } = req;
  const { userId, loggedIn } = req.cookies;
  const { evaluationId, competencyId, category } = req.params;
  let competency = {};
  let requirements;
  // get competency name
  pool.query(`SELECT competency FROM ${category}_competencies WHERE id = ${competencyId}`)
    .then((result) => {
      competency = result.rows[0];
    })
    .then(() =>
    // get all 3 levels for the selected competency
      pool.query(`SELECT ${category}_levels.level, ${category}_levels.id, ${category}_levels.description, ${category}_competencies.competency FROM ${category}_levels INNER JOIN ${category}_competencies ON ${category}_competencies.id = ${category}_levels.${category}_competency_id WHERE ${category}_competencies.id = ${competencyId}`))
    .then((result) => {
      competency.info = result.rows;
    })
    // get job title id
    .then(() => pool.query(`SELECT employees.job_title_id FROM employees INNER JOIN evaluations on employees.id = evaluations.employee_id WHERE evaluations.id = ${evaluationId}`))
    .then((result) => {
      const { job_title_id } = result.rows[0];
      return pool.query(`SELECT general_levels.level, general_levels.description, general_competencies.competency, general_competencies.description FROM general_levels INNER JOIN general_job_requirement ON general_job_requirement.general_levels_id = general_levels.id INNER JOIN general_competencies ON general_competencies.id = general_levels.general_competency_id WHERE general_job_requirement.job_title_id = ${job_title_id}`);
    })
    .then((result) => {
      requirements = result.rows;
    })
    .then(() =>
      // get level chosen and action of the selection for the specific competency
      pool.query(`SELECT * from employee_competencies WHERE evaluations_id = ${evaluationId} and general_competencies_id = ${competencyId}`))
    .then((result) => {
      const employeeCompetencies = result.rows[0];
      res.render('competencySelectionEdit', {
        competency, requirements, evaluationId, category, competencyId, employeeCompetencies, isManager, loggedIn,
      });
    });
});

// update employee competencies table based on user's edit
app.put('/evaluationForm/:evaluationId/:category/competencies/:competencyId/edit', (req, res) => {
  const { levelId, actionPlan } = req.body;
  const { evaluationId, competencyId, category } = req.params;
  // update employee_competencies table based on new user inputs
  pool.query(`UPDATE employee_competencies SET general_levels_id=${levelId}, action_plan='${actionPlan}' WHERE evaluations_id=${evaluationId} AND general_competencies_id=${competencyId}`)
    .then(() => {
      res.redirect(`/evaluationForm/${evaluationId}`);
    })
    .catch((err) => {
      console.log('insert query error', err);
    });
});

// update employee competencies table based on MANAGER's edit
app.put('/evaluationForm/:evaluationId/:category/competencies/:competencyId/managerEdit', (req, res) => {
  const { levelId, actionPlan } = req.body;
  const { evaluationId, competencyId, category } = req.params;
  // update employee_competencies table based on manager edits
  pool.query(`UPDATE employee_competencies SET manager_level_id=${levelId}, manager_comment='${actionPlan}' WHERE (evaluations_id=${evaluationId} AND general_competencies_id=${competencyId})`)
    .then(() => {
      res.redirect(`/evaluationForm/${evaluationId}`);
    })
    .catch((err) => {
      console.log('insert query error', err);
    });
});

app.post('/evaluationForm/:evaluationId/:category/competencies/:competencyId', (req, res) => {
  const { evaluationId, category, competencyId } = req.params;
  const { levelId, actionPlan } = req.body;
  // insert new competency info into employee competencies table and redirect to evaluation form
  pool.query(`INSERT INTO employee_competencies (general_competencies_id, general_levels_id, action_plan, evaluations_id) VALUES (${competencyId}, ${levelId}, '${actionPlan}', ${evaluationId})`)
    .then(() => {
      res.redirect(`/evaluationForm/${evaluationId}`);
    })
    .catch((err) => {
      console.log('query error', err);
    });
});

app.post('/competencies', (req, res) => {
  const test = req.query;
  const actionPlan = req.body;
  res.redirect('employeeEvaluation');
});

app.listen(PORT, () => { console.log(`listening on port ${PORT}`);
});
