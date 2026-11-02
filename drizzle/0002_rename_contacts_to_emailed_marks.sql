-- "contacts" were always emailed marks; the table now says so. Keeps existing rows.
ALTER TABLE `contacts` RENAME TO `emailed_marks`;
