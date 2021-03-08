COPY general_competencies(competency, description)
FROM 'general_competencies.csv'
DELIMITER ','
CSV HEADER;

COPY job_titles(job_title, job_category_id)
FROM 'job_titles_HR.csv'
DELIMITER ','
CSV HEADER;

COPY general_job_requirements(job_title_id, general_levels_id)
FROM 'general_job_requirements_HR.csv'
DELIMITER ','
CSV HEADER;

COPY general_levels(general_competency_id, level, description)
FROM 'general_levels.csv'
DELIMITER ','
CSV HEADER;

INSERT INTO job_category (name) VALUES ('HR');
INSERT INTO job_category (name) VALUES ('ICT');
INSERT INTO job_category (name) VALUES ('Logistics');
INSERT INTO job_category (name) VALUES ('Training and Education');