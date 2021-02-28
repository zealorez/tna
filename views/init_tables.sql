CREATE TABLE employees (
	id SERIAL PRIMARY KEY,
	name TEXT,
	email TEXT,
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
	general_competency_id INT,
	level TEXT,
	description TEXT
)

CREATE TABLE job_titles (
	id SERIAL PRIMARY KEY,
	job_title TEXT,
  job_category_id INT
);

CREATE TABLE job_category (
	id SERIAL PRIMARY KEY,
	name TEXT
)

CREATE TABLE general_job_requirement (
	id SERIAL PRIMARY KEY,
	job_title_id INT,
	general_levels_id INT
)