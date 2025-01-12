package webui

import (
	"os"
	"strings"
	"time"

	"github.com/go-macaron/binding"
	"github.com/toni-moreno/snmpcollector/pkg/agent"
	"github.com/toni-moreno/snmpcollector/pkg/config"
	"github.com/toni-moreno/snmpcollector/pkg/data/snmp"
	"gopkg.in/macaron.v1"
)

// NewAPIRtAgent Runtime Agent REST API creator
func NewAPIRtAgent(m *macaron.Macaron) error {
	bind := binding.Bind

	m.Group("/api/rt/agent", func() {
		m.Get("/reload/", reqSignedIn, AgentReloadConf)
		m.Get("/shutdown/", reqSignedIn, AgentShutdown)
		m.Post("/snmpconsole/ping/", reqSignedIn, bind(config.SnmpDeviceCfg{}), PingSNMPDevice)
		m.Post("/snmpconsole/query/:getmode/:obtype/:data", reqSignedIn, bind(config.SnmpDeviceCfg{}), QuerySNMPDevice)
		m.Get("/info/version/", RTGetVersion)
	})

	return nil
}

// AgentReloadConf xx
func AgentReloadConf(ctx *Context) {
	// swagger:operation GET /rt/agent/reload Runtime_Agent AgentReloadConf
	//---
	// summary: Reload Configuration and restart devices
	// description: Reload Configuration and restart devices
	// tags:
	// - "Runtime Agent"
	// responses:
	//   '200':
	//     description: Reload Duration in miliseconds
	//     schema:
	//       "$ref": "#/responses/idOfDurationResp"
	//   '405':
	//     description: unexpected error
	//     schema:
	//       "$ref": "#/responses/idOfStringResp"

	log.Info("trying to reload configuration for all devices")
	time, err := agent.ReloadConf()
	if err != nil {
		ctx.JSON(405, err.Error())
		return
	}
	ctx.JSON(200, time)
}

// AgentShutdown xx
func AgentShutdown(ctx *Context) {
	// swagger:operation GET /rt/agent/shutdown Runtime_Agent AgentShutdown
	//---
	// summary: Finalices inmediately the process
	// description: shutdown the process , (usefull only with some external restart tools )
	// tags:
	// - "Runtime Agent"
	//
	// responses:
	//   '200':
	//     description: Reload Duration in miliseconds
	//     schema:
	//       "$ref": "#/responses/idOfDurationResp"

	log.Info("receiving shutdown")
	ctx.JSON(200, "Init shutdown....")
	os.Exit(0)
}

// PingSNMPDevice xx
func PingSNMPDevice(ctx *Context, cfg config.SnmpDeviceCfg) {
	// swagger:operation POST /rt/agent/snmpconsole/ping Runtime_SNMP_Console PingSNMPDevice
	//---
	// summary:  Connectivity test to the device
	// description: |
	//    Check connectivity by test snmp connection and  will return Basic system Info from SNMP device
	// tags:
	// - "SNMP Console Tool"
	//
	// parameters:
	// - name: SnmpDeviceCfg
	//   in: body
	//   description: device to query
	//   required: true
	//   schema:
	//       "$ref": "#/definitions/SnmpDeviceCfg"
	//
	// responses:
	//   '200':
	//     description: snmp responses
	//     schema:
	//       "$ref": "#/definitions/SnmpQueryResponse"
	//   '400':
	//     description: unexpected error
	//     schema:
	//       "$ref": "#/responses/idOfStringResp"

	log.Infof("trying to ping device %s : %+v", cfg.ID, cfg)

	_, sysinfo, err := snmp.GetClient(&cfg, log, "ping", false, 0)
	if err != nil {
		log.Debugf("ERROR  on query device : %s", err)
		ctx.JSON(400, err.Error())
	} else {
		log.Debugf("OK on query device ")
		ctx.JSON(200, sysinfo)
	}
}

// SnmpQueryResponse response for queries in the UI
// swagger:model SnmpQueryResponse
type SnmpQueryResponse struct {
	DeviceCfg   *config.SnmpDeviceCfg
	TimeTaken   float64
	PingInfo    *snmp.SysInfo
	QueryResult []snmp.EasyPDU
}

// QuerySNMPDevice xx
func QuerySNMPDevice(ctx *Context, cfg config.SnmpDeviceCfg) {
	// swagger:operation POST /rt/agent/snmpconsole/query/{getmode}/{obtype}/{data} Runtime_SNMP_Console QuerySNMPDevice
	//---
	// summary:  Run a SNMP Query for a device
	// description: |
	//    Check connectivity by test snmp connection with Device configuration and  will return Basic system Info for the remote SNMP device
	// tags:
	// - "SNMP Console Tool"
	//
	// parameters:
	// - name: getmode
	//   in: path
	//   description: SNMP Get type
	//   required: true
	//   type: string
	//   enum: [get,walk]
	// - name: obtype
	//   in: path
	//   description: type of object in (snmpmetric,snmpmeasurement,...)
	//   required: true
	//   type: string
	//   enum: [snmpmetric,snmpmeasurement]
	// - name: data
	//   in: path
	//   description: id for the objecttype to qyery (snmpmetric,snmpmeasurement,...)
	//   required: true
	//   type: string
	// - name: SnmpDeviceCfg
	//   in: body
	//   description: device to query
	//   required: true
	//   schema:
	//       "$ref": "#/definitions/SnmpDeviceCfg"
	//
	// responses:
	//   '200':
	//     description: snmp responses
	//     schema:
	//       "$ref": "#/definitions/SnmpQueryResponse"
	//   '400':
	//     description: unexpected error
	//     schema:
	//       "$ref": "#/responses/idOfStringResp"

	getmode := ctx.Params(":getmode")
	obtype := ctx.Params(":obtype")
	data := strings.TrimSpace(ctx.Params(":data"))

	log.Infof("trying to query device %s : getmode: %s objectype: %s data %s", cfg.ID, getmode, obtype, data)

	if obtype != "oid" {
		log.Warnf("Object Type [%s] Not Supperted", obtype)
		ctx.JSON(400, "Object Type [ "+obtype+"] Not Supperted")
		return
	}

	snmpcli, info, err := snmp.GetClient(&cfg, log, "query", false, 0)
	if err != nil {
		log.Debugf("ERROR  on open connection with device %s : %s", cfg.ID, err)
		ctx.JSON(400, err.Error())
		return
	}
	start := time.Now()
	result, err := snmp.Query(snmpcli, getmode, data)
	elapsed := time.Since(start)
	if err != nil {
		log.Debugf("ERROR  on query device : %s", err)
		ctx.JSON(400, err.Error())
		return
	}
	log.Debugf("OK on query device ")
	snmpdata := SnmpQueryResponse{
		&cfg,
		elapsed.Seconds(),
		info,
		result,
	}
	ctx.JSON(200, snmpdata)
}

// RTGetVersion xx
func RTGetVersion(ctx *Context) {
	// swagger:operation GET /rt/agent/info/version Runtime_Agent RTGetVersion
	//---
	// summary: Get Agent Version
	// description: Get Agent Version, release , commit , compilation day
	// tags:
	// - "Runtime Agent"
	//
	// security: []
	//
	// responses:
	//   '200':
	//     description: Agent Version Info
	//     schema:
	//      "$ref": "#/definitions/RInfo"

	info := agent.GetRInfo()
	ctx.JSON(200, &info)
}
