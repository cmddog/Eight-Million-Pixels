-- Custom SQL migration file, put your code below! --
UPDATE `key-value` SET `key` = 'triggerUpdateChannelId' WHERE `key` = 'triggerCreateAnnouncementChannelId';
