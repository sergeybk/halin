import React, { Component } from 'react';
import _ from 'lodash';
import 'semantic-ui-css/semantic.min.css';
import { Grid } from 'semantic-ui-react';
import * as PropTypes from "prop-types";
import {
    TimeSeries,
    TimeRange,
    Stream,
} from "pondjs";
import uuid from 'uuid';
import Spinner from '../Spinner';

import { styler, Charts, Legend, ChartContainer, ChartRow, YAxis, LineChart } from 'react-timeseries-charts';
import NodeLabel from '../NodeLabel';

const DEFAULT_PALETTE = [
    '#f68b24', 'steelblue', '#619F3A', '#dfecd7', '#e14594', '#7045af', '#2b3595',
];

/**
 * Repeatedly executes the same cypher query in a loop on a given timeline,
 * and updates a timeseries chart.
 */
class CypherTimeseries extends Component {
    state = {
        startTime: new Date(),
        query: null,
        data: null,
        events: null,
        time: new Date(),
        lastDataArrived: new Date(),
        disabled: {},
        minObservedValue: Infinity,
        maxObservedValue: -Infinity,
        tracker: null,
        timeRange: null,
    };

    constructor(props, context) {
        super(props, context);
        this.driver = props.driver || context.driver;
        this.id = uuid.v4();

        if (!props.query) {
            throw new Error('query is required');
        } else if (!props.displayColumns) {
            throw new Error('displayColumns is required');
        }

        this.query = props.query;
        this.rate = props.rate || 1000;
        this.width = props.width || 800;
        this.min = props.min || (data => this.state.minObservedValue);
        this.max = props.max || (data => this.state.maxObservedValue);
        this.timeWindowWidth = props.timeWindowWidth || 1000 * 60 * 2;  // 2 min
        this.displayColumns = props.displayColumns;
        this.palette = props.palette || DEFAULT_PALETTE;
        this.showGrid = _.isNil(props.showGrid) ? false : props.showGrid;
        this.showGridPosition = _.isNil(props.showGridPosition) ? 'over' : props.showGridPosition;

        // By default, enable only those specified, otherwise all are on by default.
        this.startingEnabled = props.startingEnabled || props.displayColumns;

        this.dateStyle = {
            fontSize: 12,
            color: "#AAA",
            borderWidth: 1,
            borderColor: "#F4F4F4"
        };
    }
    
    componentDidMount() {
        this.mounted = true;

        this.feed = window.halinContext.getDataFeed({
            node: this.props.node,
            driver: this.props.driver,
            query: this.props.query,
            rate: this.props.rate, 
            windowWidth: this.props.timeWindowWidth,
            displayColumns: this.props.displayColumns,
            params: {},
        });

        this.feed.onData = (newData, dataFeed) => 
            this.onData(newData, dataFeed);

        const disabled = {};

        this.displayColumns.forEach((col, idx) => {
            let disabledFlag;

            if (this.startingEnabled.filter(i => i.accessor === col.accessor).length > 0) {
                disabledFlag = false;
            } else {
                disabledFlag = true;
            }

            disabled[idx] = disabledFlag;
        });

        // Ring buffer captures all of the data that gets displayed. 
        // Can't keep everything, but we need a ring big enough to get as many samples
        // as the time window is wide.  I'm arbitrarily adding 25% just so we don't miss
        // data.

        const curState = this.feed.currentState();

        this.setState({ 
            disabled,
            ...curState,
            startTime: new Date(),
        });

        this.stream = new Stream();
        this.onData(curState, this.feed);
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    onData(newData, dataFeed) {
        if (this.mounted) {
            const computedMin = this.feed.min() * 0.85;
            const computedMax = this.feed.max() * 1.15;

            const maxObservedValue = Math.max(
                this.state.maxObservedValue,
                computedMax
            );

            const minObservedValue = Math.min(
                this.state.minObservedValue,
                computedMin
            );

            // Start of the window is the greater of two values, either when the component started,
            // or the current moment minus the window.  This means data scroll starts on the left and moves
            // to the right.  When it gets to the far right, the whole timeline scrolls along.
            const startTime = new Date(Math.max(this.state.startTime.getTime(), 
                (newData.time.getTime() - (this.timeWindowWidth))));
            
            // The end time is the greater of two values: the start time plus the window,
            // or the current data point + 1 sec into the future.
            const endTime = new Date(Math.max(
                this.state.startTime.getTime() + this.timeWindowWidth, 
                newData.time.getTime() + (1000)));

            const timeRange = new TimeRange(startTime, endTime);
            //     new Date(newData.time.getTime() - (this.timeWindowWidth)),
            //     new Date(newData.time.getTime() + (10 * 1000))
            // );

            const newState = {
                ...newData,
                maxObservedValue,
                minObservedValue,
                timeRange,
            };

            // if (!this.state.timeRange) {
            //     newState.timeRange = timeRange;
            // }

            this.setState(newState);
        } else {
            return null;
        }
    }

    getChartMin() {
        let min;

        if (_.isFunction(this.min)) {        
            min = this.min(this.state.data[0]);
        } else {
            min = this.min;
        }

        return min;
    }

    getChartMax() {
        let max;
        if (_.isFunction(this.max)) {
            max = this.max(this.state.data[0]);
        } else {
            max = this.max;
        }

        return max;
    }

    chooseColor(idx) {
        if (_.isNil(idx)) {
            return this.palette[0];
        }

        if (this.state.disabled[idx]) {
            return 'transparent';
        }

        return this.palette[idx % this.palette.length];
    }

    legendClick = data => {
        console.log('Legend clicked',data);

        // Find index and toggle its disabled state.
        let foundIdx;

        this.displayColumns.forEach((item, idx) => {            
            if (item.accessor === data) {
                foundIdx = idx;
            }
        });
        
        const toggle = idx => {
            const disabledNew = _.cloneDeep(this.state.disabled);
            disabledNew[idx] = !this.state.disabled[idx];
            this.setState({ disabled: disabledNew });
        };

        toggle(foundIdx);
        // console.log('disabled',this.state.disabled);
    };
    
    handleTimeRangeChange = timeRange => {
        this.setState({ timeRange });
    };
    
    handleTrackerChanged = (t, scale) => {
        this.setState({
            tracker: t,
            trackerEvent: t && this.dataSeries.at(this.dataSeries.bisect(t)),
            trackerX: t && scale(t)
        });
    };

    render() {
        if (!this.state.events) { return 'Loading...'; }
        const style = styler(this.displayColumns.map((col, idx) => ({
            key: col.accessor, 
            color: this.chooseColor(idx),
            width: 3,
        })));

        this.dataSeries = new TimeSeries({
            name: "Data Series",
            events: this.state.events.toArray(),
        });

        // const tracker = this.state.tracker ? `${this.state.tracker}` : "";
        // const markerStyle = {
        //     backgroundColor: "rgba(255, 255, 255, 0.8)",
        //     color: "#AAA",
        //     marginLeft: "5px"
        // };        

        return (this.state.data && this.mounted) ? (
            <div className="CypherTimeseries">
                <Grid>
                    <Grid.Row columns={1}>
                        <Grid.Column>
                            <Legend type="swatch"
                                style={style}
                                onSelectionChange={this.legendClick}
                                categories={this.displayColumns.map((col, idx) => ({
                                    key: col.accessor,
                                    label: col.Header || col.accessor,
                                    style: { fill: this.chooseColor(idx) },
                                }))}
                            />
                        </Grid.Column>
                        {/* <Grid.Column>
                            <span style={this.dateStyle}>{`${this.state.time}`}</span>
                        </Grid.Column> */}
                    </Grid.Row>
                    {/* <Grid.Row columns={1}>
                        <Grid.Column>
                        {this.state.tracker ? (
                            <div style={{ position: "relative" }}>
                                <div style={{ position: "absolute", left: this.state.trackerX }}>
                                    <div style={markerStyle}>
                                        Data In: {
                                            (this.state.trackerEvent.get("totalMem") || 'foo')
                                        }
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        </Grid.Column>
                    </Grid.Row> */}
                    <Grid.Row columns={1}>
                        <Grid.Column textAlign='left'>
                            <ChartContainer 
                                showGrid={this.showGrid}
                                showGridPosition={this.showGridPosition}
                                width={this.width} 
                                enablePanZoom={true}
                                trackerPosition={this.state.tracker}
                                onTrackerChanged={this.handleTrackerChanged}
                                onTimeRangeChanged={this.handleTimeRangeChange}
                                timeRange={this.state.timeRange}>
                                <ChartRow height="150">
                                    <YAxis id="y" 
                                        min={this.getChartMin()} 
                                        max={this.getChartMax()} 
                                        width="70" 
                                        showGrid={true}
                                        type="linear"/>
                                    <Charts>
                                        {
                                            this.displayColumns.map((col, idx) => 
                                                <LineChart key={`ct-${idx}`}
                                                    axis="y" 
                                                    style={style} 
                                                    columns={[col.accessor]}
                                                    series={this.dataSeries}
                                                    />
                                            )
                                        }
                                    </Charts>
                                </ChartRow>
                            </ChartContainer>

                            <NodeLabel node={this.props.node}/>
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            </div>
        ) : <Spinner active={true}/>;
    }
}

CypherTimeseries.contextTypes = {
    driver: PropTypes.object,
};

export default CypherTimeseries;