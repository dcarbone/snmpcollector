import { HttpService } from '../core/http.service';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs/Observable';

declare var _: any;

@Injectable()
export class CustomFilterService {

  parseJSON (key,value) {
    return value;
  }

  constructor(public httpAPI: HttpService) {
    console.log('Task Service created.', httpAPI);
  }

  addCustomFilter(dev) {
    return this.httpAPI.post('/api/cfg/customfilter', JSON.stringify(dev, this.parseJSON))
      .map((responseData) => responseData.json());
  }

  editCustomFilter(dev, id, hideAlert?) {
    console.log("DEV: ", dev);
    return this.httpAPI.put('/api/cfg/customfilter/' + id, JSON.stringify(dev,this.parseJSON),null,hideAlert)
      .map((responseData) => responseData.json());
  }

  getCustomFilter(filter_s: string) {
    // return an observable
    return this.httpAPI.get('/api/cfg/customfilter')
      .map((responseData) => {
        return responseData.json();
      })
      .map((measurement) => {
        console.log("MAP SERVICE", measurement);
        let result = [];
        if (measurement) {
          _.forEach(measurement, function(value, key) {
            console.log("FOREACH LOOP", value, key);
            if (filter_s && filter_s.length > 0) {
              console.log("maching: " + value.ID + "filter: " + filter_s);
              var re = new RegExp(filter_s, 'gi');
              if (value.ID.match(re)) {
                result.push(value);
              }
              console.log(value.ID.match(re));
            } else {
              result.push(value);
            }
          });
        }
        return result;
      });
  }

  getCustomFilterById(id: string) {
    // return an observable
    console.log("ID: ", id);
    return this.httpAPI.get('/api/cfg/customfilter/' + id)
      .map((responseData) =>
        responseData.json()
      )
  };

  checkOnDeleteCustomFilter(id: string) {
    return this.httpAPI.get('/api/cfg/customfilter/checkondel/' + id)
      .map((responseData) =>
        responseData.json()
      ).map((deleteobject) => {
        console.log("MAP SERVICE", deleteobject);
        let result: any = { 'ID': id };
        _.forEach(deleteobject, function(value, key) {
          result[value.TypeDesc] = [];
        });
        _.forEach(deleteobject, function(value, key) {
          result[value.TypeDesc].Description = value.Action;
          result[value.TypeDesc].push(value.ObID);
        });
        return result;
      });
  };

  deleteCustomFilter(id: string, hideAlert?) {
    // return an observable
    console.log("ID: ", id);
    console.log("DELETING");
    return this.httpAPI.delete('/api/cfg/customfilter/' + id, null, hideAlert)
      .map((responseData) =>
        responseData.json()
      );
  };
}
