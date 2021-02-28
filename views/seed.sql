COPY general_competencies(competency)
FROM '/home/zephaniah/Desktop/tna/CompetencyDatabase.csv'
DELIMITER ','
CSV HEADER;

COPY job_titles(job_title)
FROM '/home/zephaniah/Desktop/database/hrJobRoles.csv'
DELIMITER ','
CSV HEADER;

COPY general_job_requirement(job_title_id, general_levels_id)
FROM '/home/zephaniah/Desktop/database/generalJobRequirementHr.csv'
DELIMITER ','
CSV HEADER;

INSERT INTO job_category (name) VALUES ('HR');
INSERT INTO job_category (name) VALUES ('ICT');
INSERT INTO job_category (name) VALUES ('Logistics');
INSERT INTO job_category (name) VALUES ('Training and Education');