import { Component, ChangeDetectionStrategy, ViewChild  } from '@angular/core';
import { FormBuilder, Validators} from '@angular/forms';
import { MeasFilterService } from './measfiltercfg.service';
import { MeasurementService } from '../measurement/measurementcfg.service';
import { CustomFilterService } from '../customfilter/customfilter.service';
import { OidConditionService } from '../oidcondition/oidconditioncfg.service';
import { FormArray, FormGroup, FormControl} from '@angular/forms';
import { ExportServiceCfg } from '../common/dataservice/export.service'
import { Observable } from 'rxjs/Rx';

import { ValidationService } from '../common/validation.service'
import { IMultiSelectOption, IMultiSelectSettings, IMultiSelectTexts } from '../common/multiselect-dropdown';

import { ExportFileModal } from '../common/dataservice/export-file-modal';
import { GenericModal } from '../common/generic-modal';
import { ItemsPerPageOptions } from '../common/global-constants';
import { TableActions } from '../common/table-actions';
import { AvailableTableActions } from '../common/table-available-actions';

import { TableListComponent } from '../common/table-list.component';
import { MeasFilterCfgComponentConfig, TableRole, OverrideRoleActions } from './measfiltercfg.data';

declare var _:any;

@Component({
  selector: 'measfilters',
  providers: [MeasFilterService, MeasurementService, CustomFilterService,OidConditionService],
  templateUrl: './measfiltereditor.html',
  styleUrls: ['../css/component-styles.css']
})

export class MeasFilterCfgComponent {
  @ViewChild('viewModal') public viewModal: GenericModal;
  @ViewChild('viewModalDelete') public viewModalDelete: GenericModal;
  @ViewChild('exportFileModal') public exportFileModal : ExportFileModal;

  selectedArray : any = [];
  public isRequesting : boolean;
  public counterItems : number = null;
  public counterErrors: any = [];

  public tableAvailableActions : any;

  itemsPerPageOptions : any = ItemsPerPageOptions;
  editmode: string; //list , create, modify
  measfilters: Array<any>;
  filter: string;
  measfilterForm: any;
  measurement: Array<any>;
  selectmeas: IMultiSelectOption[] = [];
  selectCustomFilters:  IMultiSelectOption[] = [];
  public defaultConfig : any = MeasFilterCfgComponentConfig;
  public tableRole : any = TableRole;
  public overrideRoleActions: any = OverrideRoleActions;
  oidconditions: Array<any>;
  selectoidcond: IMultiSelectOption[] = [];

  myFilterValue: any;

  private mySettings: IMultiSelectSettings = {
      singleSelect: true,
  };

  //Initialization data, rows, colunms for Table
  private data: Array<any> = [];
  public rows: Array<any> = [];

  public page: number = 1;
  public itemsPerPage: number = 20;
  public maxSize: number = 5;
  public numPages: number = 1;
  public length: number = 0;
  private builder;
  private oldID : string;
  //Set config
  public config: any = {
    paging: true,
    sorting: { columns: this.defaultConfig['table-columns'] },
    filtering: { filterString: '' },
    className: ['table-striped', 'table-bordered']
  };

  constructor(public oidCondService: OidConditionService,public customFilterService: CustomFilterService, public measFilterService: MeasFilterService, public measMeasFilterService: MeasurementService, public exportServiceCfg : ExportServiceCfg, builder: FormBuilder) {
    this.editmode = 'list';
    this.reloadData();
    this.builder = builder;
  }

  createStaticForm() {
    this.measfilterForm = this.builder.group({
      ID: [this.measfilterForm ? this.measfilterForm.value.ID : '', Validators.required],
      IDMeasurementCfg: [this.measfilterForm ? this.measfilterForm.value.IDMeasurementCfg : '', Validators.required],
      FType: [this.measfilterForm ? this.measfilterForm.value.FType : 'OIDCondition', Validators.required],
      Description: [this.measfilterForm ? this.measfilterForm.value.Description : '']
    });
  }

  createDynamicForm(fieldsArray: any) : void {
    //Saves the actual to check later if there are shared values
    let tmpform : any;
    if (this.measfilterForm)  tmpform = this.measfilterForm.value;
    this.createStaticForm();

    for (let entry of fieldsArray) {
      let value = entry.defVal;
      //Check if there are common values from the previous selected item
      if (tmpform) {
        if (tmpform[entry.ID] && entry.override !== true) {
          value = tmpform[entry.ID];
        }
      }
      //Set different controls:
      this.measfilterForm.addControl(entry.ID, new FormControl(value, entry.Validators));
    }
  }

  setDynamicFields (field : any, override? : boolean) : void  {
    //Saves on the array all values to push into formGroup
    let controlArray : Array<any> = [];
    switch (field) {
      case 'file':
        controlArray.push({'ID': 'FilterName', 'defVal' : '', 'Validators' : Validators.required, 'override' : override});
        controlArray.push({'ID': 'EnableAlias', 'defVal' : 'true', 'Validators' : Validators.required});

        break;
      case 'CustomFilter':
        this.getCustomFiltersforMeasFilters();
        controlArray.push({'ID': 'FilterName', 'defVal' : '', 'Validators' : Validators.required, 'override' : override});
        controlArray.push({'ID': 'EnableAlias', 'defVal' : 'true', 'Validators' : Validators.required});

      break;
      default: //OID Condition
        this.getOidCond();
        controlArray.push({'ID': 'FilterName', 'defVal' : '', 'Validators' : Validators.required, 'override' : override});
        break;
    }
    //Reload the formGroup with new values saved on controlArray
    this.createDynamicForm(controlArray);
  }

  applyAction(test : any, data? : Array<any>) : void {
    this.selectedArray = data || [];
    switch(test.action) {
       case "RemoveAllSelected": {
          this.removeAllSelectedItems(this.selectedArray);
          break;
       }
       default: {
          break;
       }
    }
  }

  customActions(action : any) {
    switch (action.option) {
      case 'export' : 
        this.exportItem(action.event);
      break;
      case 'new' :
        this.newMeasFilter()
      case 'view':
        this.viewItem(action.event);
      break;
      case 'edit':
        this.editMeasFilter(action.event);
      break;
      case 'remove':
        this.removeItem(action.event);
      break;
      case 'tableaction':
        this.applyAction(action.event, action.data);
      break;
    }
  }

  reloadData() {
    this.selectedArray = [];
    this.isRequesting = true;
    // now it's a simple subscription to the observable
    this.measFilterService.getMeasFilter(this.filter)
      .subscribe(
      data => {
        this.isRequesting = false;
        this.measfilters = data;
        this.data = data;
      },
      err => console.error(err),
      () => console.log('DONE')
      );
  }

  onFilter() {
    this.reloadData();
  }

  viewItem(id) {
    console.log('view', id);
    this.viewModal.parseObject(id);
  }

  exportItem(item : any) : void {
    this.exportFileModal.initExportModal(item);
  }

  removeAllSelectedItems(myArray) {
    let obsArray = [];
    this.counterItems = 0;
    this.isRequesting = true;
    for (let i in myArray) {
      console.log("Removing ",myArray[i].ID)
      this.deleteMeasFilter(myArray[i].ID,true);
      obsArray.push(this.deleteMeasFilter(myArray[i].ID,true));
    }
    this.genericForkJoin(obsArray);
  }

  removeItem(row) {
    let id = row.ID;
    console.log('remove', id);
    this.measFilterService.checkOnDeleteMeasFilter(id)
      .subscribe(
      data => {
        console.log(data);
        let temp = data;
        this.viewModalDelete.parseObject(temp)
      },
      err => console.error(err),
      () => { }
      );
  }

  newMeasFilter() {
    if (this.measfilterForm) {
      this.setDynamicFields(this.measfilterForm.value.FType);
    } else {
      this.setDynamicFields(null);
    }
    this.getMeasforMeasFilters();
    this.editmode = "create";
  }

  editMeasFilter(row) {
    let id = row.ID;
    this.getMeasforMeasFilters();
    this.measFilterService.getMeasFilterById(id)
      .subscribe(data => {
        this.measfilterForm = {};
        this.measfilterForm.value = data;
        this.setDynamicFields(row.FType, false);
        this.oldID = data.ID
        this.editmode = "modify"
      },
      err => console.error(err),
      );
  }

  deleteMeasFilter(id, recursive?) {
    if (!recursive) {
      this.measFilterService.deleteMeasFilter(id)
        .subscribe(data => { },
        err => console.error(err),
        () => { this.viewModalDelete.hide(); this.editmode = "list"; this.reloadData() }
        );
    } else {
      return this.measFilterService.deleteMeasFilter(id, true)
      .do(
        (test) =>  { this.counterItems++},
        (err) => { this.counterErrors.push({'ID': id, 'error' : err})}
      );
    }
  }

  cancelEdit() {
    this.editmode = "list";
  }
  saveMeasFilter() {
    if (this.measfilterForm.valid) {
      this.measFilterService.addMeasFilter(this.measfilterForm.value)
        .subscribe(data => { console.log(data) },
        err => console.error(err),
        () => { this.editmode = "list"; this.reloadData() }
        );
    }
  }

  updateAllSelectedItems(mySelectedArray,field,value, append?) {
    let obsArray = [];
    this.counterItems = 0;
    this.isRequesting = true;
    if (!append)
    for (let component of mySelectedArray) {
      component[field] = value;
      obsArray.push(this.updateMeasFilter(true,component));
    } else {
      let tmpArray = [];
      if(!Array.isArray(value)) value = value.split(',');
      console.log(value);
      for (let component of mySelectedArray) {
        console.log(value);
        //check if there is some new object to append
        let newEntries = _.differenceWith(value,component[field],_.isEqual);
        tmpArray = newEntries.concat(component[field])
        console.log(tmpArray);
        component[field] = tmpArray;
        obsArray.push(this.updateMeasFilter(true,component));
      }
    }
    this.genericForkJoin(obsArray);
    //Make sync calls and wait the result
    this.counterErrors = [];
  }

  updateMeasFilter(recursive?, component?) {
    if(!recursive) {
      if (this.measfilterForm.valid) {
        var r = true;
        if (this.measfilterForm.value.ID != this.oldID) {
          r = confirm("Changing Measurement Filter ID from " + this.oldID + " to " + this.measfilterForm.value.ID + ". Proceed?");
        }
        if (r == true) {
          this.measFilterService.editMeasFilter(this.measfilterForm.value, this.oldID)
            .subscribe(data => { console.log(data) },
            err => console.error(err),
            () => { this.editmode = "list"; this.reloadData() }
            );
        }
      }
    } else {
      return this.measFilterService.editMeasFilter(component, component.ID, true)
      .do(
        (test) =>  { this.counterItems++ },
        (err) => { this.counterErrors.push({'ID': component['ID'], 'error' : err['_body']})}
      )
      .catch((err) => {
        return Observable.of({'ID': component.ID , 'error': err['_body']})
      })
    }
  }

  getMeasforMeasFilters() {
    this.measMeasFilterService.getMeas(null)
      .subscribe(
      data => {
        this.measurement = data;
        this.selectmeas = [];
        for (let entry of data) {
          console.log(entry)
          this.selectmeas.push({ 'id': entry.ID, 'name': entry.ID });
          if (entry.GetMode == "indexed_multiple") {
            for (let mi of entry.MultiIndexCfg) {
              this.selectmeas.push({'id': entry.ID+'..'+mi.Label, 'name': mi.Label, 'badge': "indexed multiple" })
            }
          }
        }

       },
      err => console.error(err),
      () => console.log('DONE')
      );
  }

  getOidCond() {
    this.oidCondService.getConditions(null)
      .subscribe(
      data => {
        this.oidconditions = data;
        this.selectoidcond = [];
        for (let entry of data) {
          console.log(entry)
          this.selectoidcond.push({ 'id': entry.ID, 'name': entry.ID });
        }
      },
      err => console.error(err),
      () => { console.log('DONE') }
      );
  }

  getCustomFiltersforMeasFilters() {
    this.customFilterService.getCustomFilter(null)
      .subscribe(
      data => {
        this.selectCustomFilters = [];
        for (let entry of data) {
          console.log(entry)
          this.selectCustomFilters.push({ 'id': entry.ID, 'name': entry.ID });
        }
       },
      err => console.error(err),
      () => console.log('DONE')
      );
  }
  genericForkJoin(obsArray: any) {
    Observable.forkJoin(obsArray)
              .subscribe(
                data => {
                  this.selectedArray = [];
                  this.reloadData()
                },
                err => console.error(err),
              );
  }
}
