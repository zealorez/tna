import express from 'express'
import pg from 'pg'
import cookieParser from 'cookie-parser'
import methodOverride from 'method-override'

// pg setup
const pgConnectionconfigs = {
    user: 'postgres',
    host: 'localhost',
    password:'postgres',
    database:'tna',
    port: 5432
}
const {Pool} = pg
const pool = new Pool(pgConnectionconfigs)
pool.connect()

// express setup
const app = express()
app.set('view engine', 'ejs')
app.use(methodOverride('__method'))
app.use(cookieParser())
app.use(express.urlencoded({extended:false}))

// global variables
let job;


// employee evaluation form
app.get('/employeeEvaluation', (req, res)=> {
    const {job_title} = req.query
    // substring method to remove the quotes
    job = job_title.substring(1, job_title.length-1)
    res.render('employeeEvaluation', {job_title})
})

// display the 4 job categories below form
app.get('/jobCategory', (req, res)=> {
    const jobCategories = ['HR', 'ICT', 'Logistics', 'Training and Education']
    res.render('jobCategory', {jobCategories})
})

// list of all jobs within one category
app.get('/jobCategory/:category', (req, res)=> {
    const {category} = req.params
    // get the category_id based on category value
    pool.query(`SELECT id FROM job_category WHERE name='${category}'`)
    .then((result)=> {
        const categoryId = result.rows[0].id
        // display all job titles based on category id
        pool.query(`SELECT job_title from job_titles where job_category_id=${categoryId}`).then((result)=> {
            const titles = result.rows
            res.render('jobTitles',{titles})
        })
    })
})

app.get('/competencies', (req, res)=> {
    //get id of job title
    pool.query(`SELECT id from job_titles WHERE job_title = '${job}'`)
    .then((result)=> {
        // inner join general_job_requirement and general_levels to get job requirement for job
        const {id} = result.rows[0]
        pool.query(`SELECT * FROM general_levels INNER JOIN general_job_requirement ON general_job_requirement.general_levels_id = general_levels.id WHERE general_job_requirement.job_title_id = ${id}`)
        .then((result)=> {
            console.log(result.rows)
        })
    })
    res.render('competencies')
})


app.listen(3000, ()=> {console.log("listening on port 3000")
})
