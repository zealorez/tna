CREATE TABLE employees (
	id SERIAL PRIMARY KEY,
	name TEXT,
	email TEXT,
	password TEXT,
	job_title_id INT,
	manager_id INT
)

CREATE TABLE general_competencies (
	id SERIAL PRIMARY KEY,
	competency TEXT,
  description TEXT
)

CREATE TABLE general_levels (
	id SERIAL PRIMARY KEY,
	level TEXT,
	description TEXT,
	general_competency_id INT
)

CREATE TABLE job_titles (
	id SERIAL PRIMARY KEY,
	job_title TEXT,
  job_category_id INT
);

CREATE TABLE job_categories (
	id SERIAL PRIMARY KEY,
	name TEXT
)

CREATE TABLE general_job_requirement (
	id SERIAL PRIMARY KEY,
	job_title_id INT,
	general_levels_id INT
)

CREATE TABLE evaluations (
	id SERIAL PRIMARY KEY,
	employee_id INT,
	date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	status TEXT
)

CREATE TABLE employee_competencies (
	id SERIAL PRIMARY KEY,
	general_competencies_id INT,
	general_levels_id INT,
	action_plan TEXT,
	manager_level_id INT,
	manager_comment TEXT,
	evaluations_id INT
)