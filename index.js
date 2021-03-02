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

// global variables
let job;

// employee evaluation form
app.get('/employeeEvaluation', (req, res) => {
  const { job_title } = req.query;
  // check if a job title has been selected
  if (job_title != undefined) {
    // substring method to remove the quotes
    job = job_title.substring(1, job_title.length - 1);
    res.render('employeeEvaluation', { job });
  } else {
    res.render('employeeEvaluation', { job: '' });
  }
});

// display the 4 job categories below form
app.get('/jobCategory', (req, res) => {
  const jobCategories = ['HR', 'ICT', 'Logistics', 'Training and Education'];
  res.render('jobCategory', { jobCategories });
});

// list of all jobs within one category
app.get('/jobCategory/:category', (req, res) => {
  const { category } = req.params;
  // get the category_id based on category value
  pool.query(`SELECT id FROM job_category WHERE name='${category}'`)
    .then((result) => {
      const categoryId = result.rows[0].id;
      // display all job titles based on category id
      return pool.query(`SELECT job_title from job_titles where job_category_id=${categoryId}`)
        .then((result) => {
          const titles = result.rows;
          res.render('jobTitles', { titles });
        });
    });
});

// list the 2 competency categories
app.get('/competencyCategories', (req, res) => {
  res.render('competencyCategories');
});

// page with required competencies for specific job and list of competencies for a chosen category
app.get('/competencies', (req, res) => {
  let requiredCompetencies = {};
  // get id of job title
  pool.query(`SELECT id from job_titles WHERE job_title = '${job}'`)
    .then((result) => {
      // get job requirement for job
      const { id } = result.rows[0];
      return pool.query(`SELECT general_levels.level, general_levels.description, general_competencies.competency, general_competencies.description FROM general_levels INNER JOIN general_job_requirement ON general_job_requirement.general_levels_id = general_levels.id INNER JOIN general_competencies ON general_competencies.id = general_levels.general_competency_id WHERE general_job_requirement.job_title_id = ${id}`);
    })
    .then((result) => {
      requiredCompetencies = result.rows;
    })
    .then(() => pool.query('SELECT * FROM general_competencies'))
    .then((result) => {
      const generalCompetencies = result.rows;
      res.render('competencies', { requiredCompetencies, generalCompetencies });
    });
});

// list out the levels of a specific competency and highlight the required competency (if there is)
app.get('/competencies/:id', (req, res) => {
  const generalCompetencyId = req.params.id;
  let competency = {};
  pool.query(`SELECT competency FROM general_competencies WHERE id = ${generalCompetencyId}`)
    .then((result) => {
      competency = result.rows[0];
    })
    .then(() =>
    // get all 3 levels for the selected competency
      pool.query(`SELECT general_levels.level, general_levels.description, general_competencies.competency FROM general_levels INNER JOIN general_competencies ON general_competencies.id = general_levels.general_competency_id WHERE general_competencies.id = ${generalCompetencyId}`))
    .then((result) => {
      competency.info = result.rows;
    })
    .then(() => pool.query(`SELECT id from job_titles WHERE job_title = '${job}'`))
    .then((result) => {
      const jobId = result.rows[0].id;
      return pool.query(`SELECT general_levels.level, general_levels.description, general_competencies.competency, general_competencies.description FROM general_levels INNER JOIN general_job_requirement ON general_job_requirement.general_levels_id = general_levels.id INNER JOIN general_competencies ON general_competencies.id = general_levels.general_competency_id WHERE general_job_requirement.job_title_id = ${jobId}`);
    })
    .then((result) => {
      const requirements = result.rows;
      res.render('competencySelection', { competency, requirements });
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
