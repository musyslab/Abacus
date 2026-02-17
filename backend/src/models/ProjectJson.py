import json
import datetime

class ProjectJson:
    Id = -1
    Name = ""
    Language = ""
    TotalSubmissions = -1

    def __init__(self, id, name, language, totalSubmissions):
        self.Id = id
        self.Name = name
        self.Language = language
        self.TotalSubmissions = totalSubmissions
    
    def json_default(self, value):
        return value.__dict__

    def to_dict(self):
        return self.__dict__