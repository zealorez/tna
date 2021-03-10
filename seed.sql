\copy general_competencies(competency, description)
FROM '/home/ubuntu/tna/general_competencies.csv'
DELIMITER ','
CSV HEADER;

\copy job_titles(job_title, job_category_id)
FROM '/home/ubuntu/tna/job_titles_HR.csv'
DELIMITER ','
CSV HEADER;

\copy general_job_requirement(job_title_id, general_levels_id)
FROM '/home/ubuntu/tna/general_job_requirements_HR.csv'
DELIMITER ','
CSV HEADER;

/copy general_levels(general_competency_id, level, description)
FROM '/home/ubuntu/tna/general_levels.csv'
DELIMITER ','
CSV HEADER;

INSERT INTO job_categories (name) VALUES ('HR');
INSERT INTO job_categories (name) VALUES ('ICT');
INSERT INTO job_categories (name) VALUES ('Logistics');
INSERT INTO job_categories (name) VALUES ('Training and Education');