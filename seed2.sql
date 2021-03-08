COPY general_job_requirement(job_title_id, general_levels_id)
FROM '/home/ubuntu/tna/general_job_requirements_HR.csv'
DELIMITER ','
CSV HEADER;