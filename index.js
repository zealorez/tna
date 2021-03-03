import express from 'express';
import pg from 'pg';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';

// pg setup
const pgConnectionconfigs = {
  user: 'postgres',
  host: 'localhost',
  password: 'postgres',
  database: 'tna',
  port: 5432,
};
const { Pool } = pg;
const pool = new Pool(pgConnectionconfigs);
pool.connect();

// express setup
const app = express();
app.set('view engine', 'ejs');
app.use(methodOverride('__method'));
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

// page with all the evaluations for an employee
app.get('/evaluations', (req, res) => {
  const { userId } = req.cookies;
  pool.query(`SELECT date FROM  evaluations WHERE employee_id = ${userId}`)
    .then((result) => {
      const dates = result.rows;
      res.render('evaluation', { dates });
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

// employee evaluation form
app.get('/evaluationForm/:evaluationId', (req, res) => {
  const { evaluationId } = req.params;
  const { userId } = req.cookies;
  let jobInfo;
  let requirements;
  // get user's job title id
  pool.query(`SELECT employees.job_title_id, job_titles.job_title FROM employees INNER JOIN job_titles ON employees.job_title_id = job_titles.id WHERE employees.job_title_id = ${userId}`)
    .then((result) => {
      jobInfo = result.rows[0];
      // get all required competencies for the user's job
      return pool.query(`SELECT general_levels.level, general_levels.description, general_competencies.competency FROM general_levels INNER JOIN general_job_requirement ON general_job_requirement.general_levels_id = general_levels.id INNER JOIN general_competencies ON general_competencies.id = general_levels.general_competency_id WHERE general_job_requirement.job_title_id = ${jobInfo.job_title_id}`);
    })
    .then((result) => {
      requirements = result.rows;
      return pool.query(`SELECT employee_competencies.general_competencies_id, employee_competencies.general_levels_id, employee_competencies.action_plan, general_competencies.competency, general_levels.level FROM employee_competencies INNER JOIN general_levels ON employee_competencies.general_levels_id = general_levels.id INNER JOIN general_competencies ON general_levels.general_competency_id = general_competencies.id WHERE employee_competencies.evaluations_id = ${evaluationId}`);
    })
    .then((result) => {
      const competencies = result.rows;
      res.render('evaluationForm', {
        requirements, jobInfo, evaluationId, competencies,
      });
    });
});

// // display the 4 job categories below form
// app.get('/jobCategory', (req, res) => {
//   const jobCategories = ['HR', 'ICT', 'Logistics', 'Training and Education'];
//   res.render('jobCategory', { jobCategories });
// });

// // list of all jobs within one category
// app.get('/jobCategory/:category', (req, res) => {
//   const { category } = req.params;
//   // get the category_id based on category value
//   pool.query(`SELECT id FROM job_category WHERE name='${category}'`)
//     .then((result) => {
//       const categoryId = result.rows[0].id;
//       // display all job titles based on category id
//       return pool.query(`SELECT job_title from job_titles where job_category_id=${categoryId}`)
//         .then((result) => {
//           const titles = result.rows;
//           res.render('jobTitles', { titles });
//         });
//     });
// });

// list the 2 competency categories
app.get('/evaluationForm/:evaluationId/competencyCategories', (req, res) => {
  const { evaluationId } = req.params;
  res.render('competencyCategories', { evaluationId });
});

// page with required competencies for specific job and list of competencies for a chosen category
app.get('/evaluationForm/:evaluationId/:category/competencies', (req, res) => {
  const { userId } = req.cookies;
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
        requiredCompetencies, categoryCompetencies, category, evaluationId,
      });
    });
});

// list out the levels of a specific competency and highlight the required competency (if there is)
app.get('/evaluationForm/:evaluationId/:category/competencies/:competencyId', (req, res) => {
  const { userId } = req.cookies;
  const { evaluationId, competencyId, category } = req.params;
  let competency = {};
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
      const requirements = result.rows;
      res.render('competencySelection', {
        competency, requirements, evaluationId, category, competencyId,
      });
    });
});

app.post('/evaluationForm/:evaluationId/:category/competencies/:competencyId', (req, res) => {
  const { evaluationId, category, competencyId } = req.params;
  const { levelId, actionPlan } = req.body;
  // insert new competency info into employee competencies table and redirect to evaluation form
  pool.query(`INSERT INTO employee_competencies (general_competencies_id, general_levels_id, action_plan, evaluations_id) VALUES (${competencyId}, ${levelId}, '${actionPlan}', ${evaluationId})`)
    .then(() => {
      res.redirect(`/evaluationForm/${evaluationId}`);
    });
});

app.post('/competencies', (req, res) => {
  const test = req.query;
  const actionPlan = req.body;
  console.log('i am req.query', test);
  console.log('i am action plan', actionPlan);
  res.redirect('employeeEvaluation');
});

app.listen(3000, () => { console.log('listening on port 3000');
});
