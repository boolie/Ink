Ink.createModule('Ink.UI.Calendar', 1, ['Ink.UI.Common_1', 'Ink.Dom.Event_1', 'Ink.Dom.Element_1', 'Ink.Dom.Css_1', 'Ink.Util.Array_1'], function (Common, Event, InkElement, Css, InkArray) {
    'use strict';

    function dateishFromDate(date) {
        return {_year: date.getFullYear(), _month: date.getMonth(), _day: date.getDate()};
    }

    function dateishCopy(dateish) {
        return {_year: dateish._year, _month: dateish._month, _day: dateish._day};
    }

    function roundDecade(year) {
        if (year._year) {
            return roundDecade(year._year);
        }

        return Math.floor(year / 10) * 10;
    }

    // Clamp a number into a min/max limit
    function clamp(n, min, max) {
        if (n > max) { n = max; }
        if (n < min) { n = min; }

        return n;
    }


    function Calendar() {
        Common.BaseUIComponent.apply(this, arguments);
    }

    Calendar._name = 'Calendar_1';

    Calendar._optionDefinition = {
        dateRange:       ['String', null],

        format:          ['String', 'yyyy-mm-dd'],
        nextLinkText:    ['String', '»'],
        prevLinkText:    ['String', '«'],
        ofText:          ['String', ' of '],
        onSetDate:       ['Function', null],
        startDate:       ['String', null], // format yyyy-mm-dd,
        startWeekDay:    ['Number', 1],

        // Validation
        validDayFn:      ['Function', null],
        validMonthFn:    ['Function', null],
        validYearFn:     ['Function', null],
        nextValidDateFn: ['Function', null],
        prevValidDateFn: ['Function', null],
        yearRange:       ['String', null],  /* [3.1.0] deprecate this */

        // Text
        month: ['Object', {
             1:'January',
             2:'February',
             3:'March',
             4:'April',
             5:'May',
             6:'June',
             7:'July',
             8:'August',
             9:'September',
            10:'October',
            11:'November',
            12:'December'
        }],
        wDay: ['Object', {
            0:'Sunday',
            1:'Monday',
            2:'Tuesday',
            3:'Wednesday',
            4:'Thursday',
            5:'Friday',
            6:'Saturday'
        }]
    };

    Calendar.prototype = {
        _init: function () {
            if (this._options.startWeekDay < 0 || this._options.startWeekDay > 6) {
                Ink.warn('Ink.UI.DatePicker_1: option "startWeekDay" must be between 0 (sunday) and 6 (saturday)');
                this._options.startWeekDay = clamp(this._options.startWeekDay, 0, 6);
            }

            Ink.extendObj(this._options,this._lang || {});

            this._setMinMax( this._options.dateRange || this._options.yearRange );

            this.setDate(this._options.startDate || new Date());  // Sets the date
            this._bindEvents();  // Binds events for changing date and whatnot.

            this._renderTopBar();  // Creates the thead
            this.monthView();  // Creates the tbody, shows the month
        },

        _bindEvents: function () {
            var self = this;

            function extendDate(partialDateish) {
                var dt = dateishCopy(self);

                if (typeof partialDateish._year === 'number') {
                    dt._year = partialDateish._year;
                }

                if (typeof partialDateish._month === 'number') {
                    dt._month = partialDateish._month;
                }

                if (typeof partialDateish._day === 'number') {
                    dt._day = partialDateish._day;
                }

                self._setDate(dt);
            }

            // Top bar
            Event.on(this._element, 'click', '[href^="#monthchanger"]', function (ev) {
                ev.preventDefault();
                self.yearView();
            });
            Event.on(this._element, 'click', '[href^="#yearchanger"]', function (ev) {
                ev.preventDefault();
                self.decadeView();
            });

            Event.on(this._element, 'click', ':not(.disabled) [href^="#next"], :not(.disabled) [href^="#prev"]', function (ev) {
                ev.preventDefault();
                var tbody = Ink.s('tbody', self._element);
                var isNext = /#next$/.test(ev.currentTarget.href);
                var fragment = Css.hasClassName(tbody, 'month') ? '_month' :
                               Css.hasClassName(tbody, 'year')  ? '_year' :
                                                                  '_decade';

                var increment = isNext ? 1 : -1;

                self._onNextPrevClicked(fragment, increment);
            });

            // Month view
            Event.on(this._element, 'click', '[data-cal-day]', function (ev) {
                extendDate({ _day: +ev.currentTarget.getAttribute('data-cal-day') });
                self.monthView();
            });
            // Year view
            Event.on(this._element, 'click', '[data-cal-month]', function (ev) {
                extendDate({ _month: +ev.currentTarget.getAttribute('data-cal-month') });
                self.monthView();
            });
            // Decade view
            Event.on(this._element, 'click', '[data-cal-year]', function (ev) {
                extendDate({ _year: +ev.currentTarget.getAttribute('data-cal-year') });
                self.yearView();
            });
        },

        _renderTopBar: function () {
            this._calendarHeader = this._element.appendChild(
                    document.createElement("thead"));

            var calendarHeaderTr = this._calendarHeader.appendChild(InkElement.create('tr'));

            var monthPrevTd = calendarHeaderTr.appendChild(InkElement.create('th', {
                className: 'previous' }));

            var monthTitleTd = calendarHeaderTr.appendChild(InkElement.create('th', {
                className: 'title',
                colspan: '5'
            }));

            var monthNextTd = calendarHeaderTr.appendChild(InkElement.create('th', {
                className: 'next' }));


            (function renderMonthTitle() {
                this._monthChanger = monthTitleTd.appendChild(InkElement.create('a', {
                    href: '#monthchanger',
                    className: 'ink-calendar-link-month'
                }));

                monthTitleTd.appendChild(InkElement.create('span', {
                    className: 'ink-calendar-of-text',
                    setHTML: this._options.ofText
                }));

                this._yearChanger = monthTitleTd.appendChild(InkElement.create('a', {
                    href: '#yearchanger',
                    className: 'ink-calendar-link-year'
                }));

                this._updateTopBar();
            }.call(this));


            monthNextTd.appendChild(InkElement.create('a', {
                href: '#next',
                className: 'change_month_next'  /* fa fa-angle-double-right (?) */,
                setHTML: this._options.nextLinkText
            }));

            monthPrevTd.appendChild(InkElement.create('a', {
                href: '#prev',
                className: 'change_month_prev'  /* see above */,
                setHTML: this._options.prevLinkText
            }));
        },

        _updateTopBar: function () {
            if (this._monthChanger && this._yearChanger) {
                InkElement.setTextContent(this._monthChanger, this._options.month[this._month + 1]);
                InkElement.setTextContent(this._yearChanger, this._year);
            }
        },

        _replaceTbody: function (className) {
            var existingTbody = Ink.s('tbody', this._element);
            if (existingTbody) {
                InkElement.remove(existingTbody);
            }
            return this._element.appendChild(InkElement.create('tbody', { className: className || '' }));
        },

        monthView: function () {
            var container = this._replaceTbody('month');

            container.appendChild(
                    this._getMonthCalendarHeader(this._options.startWeekDay));

            container.appendChild(
                    this._getDayButtons(dateishCopy(this)));
        },

        /** Write the top bar of the calendar (M T W T F S S) */
        _getMonthCalendarHeader: function (startWeekDay) {
            var header = InkElement.create('tr', {
                className: 'header'
            });

            var wDay;
            for(var i=0; i<7; i++){
                wDay = (startWeekDay + i) % 7;
                header.appendChild(InkElement.create('td', {
                    setTextContent: this._options.wDay[wDay].substring(0, 1)
                }));
            }

            return header;
        },

        /**
         * Figure out where the first day of a month lies
         * in the first row of the calendar.
         *
         *      having options.startWeekDay === 0
         *
         *      Su Mo Tu We Th Fr Sa  
         *                         1  <- The "1" is in the 7th day. return 6.
         *       2  3  4  5  6  7  8  
         *       9 10 11 12 13 14 15  
         *      16 17 18 19 20 21 22  
         *      23 24 25 26 27 28 29  
         *      30 31
         *
         * This obviously changes according to the user option "startWeekDay"
         **/
        _getFirstDayIndex: function (year, month) {
            var wDayFirst = (new Date( year , month , 1 )).getDay();  // Sunday=0
            var startWeekDay = this._options.startWeekDay || 0;  // Sunday=0

            var result = wDayFirst - startWeekDay;

            result %= 7;

            if (result < 0) {
                result += 6;
            }

            return result;
        },

        _getDayButtons: function (date) {
            var daysInMonth = this._daysInMonth(date._year, date._month);

            var ret = document.createDocumentFragment();

            var tr = InkElement.create('tr');
            ret.appendChild(tr);

            var firstDayIndex = this._getFirstDayIndex(date._year, date._month);

            // Add padding if the first day of the month is not monday.
            for (var i = 0; i < firstDayIndex; i ++) {
                tr.appendChild(InkElement.create('td'));
            }

            for (date._day = 1; date._day <= daysInMonth; date._day++) {
                if ((date._day - 1 + firstDayIndex) % 7 === 0){ // new week, new tr
                    tr = ret.appendChild(InkElement.create('tr'));
                }

                tr.appendChild(this._getButton({
                    number: date._day,
                    date: date,
                    dayMonthOrYear: 'day',
                    validator: this._acceptableDay
                }));
            }
            return ret;
        },

        yearView: function () {
            var yearView = this._replaceTbody('year');

            var tr = document.createElement('tr');
            for(var mon=0; mon<12; mon++){
                var monthButton = this._getButton({ number: mon,
                    date: { _year: this._year, _month: mon },
                    dayMonthOrYear: 'month', validator: this._acceptableMonth,
                    linkText: this._options.month[mon + 1].substring(0, 3)
                });

                tr.appendChild(monthButton);

                if (mon % 4 === 3) {
                    monthButton.setAttribute('colspan', 4);
                    yearView.appendChild(tr);
                    tr = document.createElement('tr');
                }
            }

            return yearView;
        },

        decadeView: function () {
            var view = this._replaceTbody('decade');

            var thisDecade = roundDecade(this);
            var nextDecade = thisDecade + 10;

            var tr = view.appendChild(InkElement.create('tr'));

            for (var year = thisDecade; year < nextDecade; year++) {
                var td = this._getButton({
                    number: year,
                    date: { _year: year },
                    dayMonthOrYear: 'year',
                    validator: this._acceptableYear
                });

                tr.appendChild(td);

                if (year % 5 === 4) {
                    td.setAttribute('colspan', 3);
                    tr = view.appendChild(InkElement.create('tr'));
                }
            }
        },

        _getButton: function (opt /* contains: number, date, dayMonthOrYear, validator, linkText */) {
            var button = InkElement.create('td');
            var link = button.appendChild(InkElement.create('a', {
                setTextContent: opt.linkText || opt.number
            }));

            var isValid = opt.validator.call(this, opt.date);
            var isToday = this._dateCmpUntil(this, opt.date,
                '_' + opt.dayMonthOrYear) === 0;

            if (isValid) {
                link.setAttribute('data-cal-' + opt.dayMonthOrYear, opt.number);
            } else {
                button.className = 'disabled';
            }

            if (isToday && isValid) {
                button.className = 'active';
            }

            return button;
        },

        /**
         * Gets the currently selected date as a JavaScript date.
         *
         * @method getDate
         */
        getDate: function () {
            return new Date(this._year, this._month, this._day);
        },

        /**
         * Sets the date
         *
         * @method setDate
         * @param {Date} newDate
         **/
        setDate: function (dateString) {
            if (dateString && typeof dateString.getDate === 'function') {
                dateString = [ dateString.getFullYear(),
                    dateString.getMonth() + 1, dateString.getDate() ].join('-');
            }

            if (dateString && dateString._year !== undefined) {
                dateString = [ dateString._year,
                    dateString._month + 1, dateString._day ].join('-');
            }

            var newDate = {};
            if ( /\d{4}-\d{1,2}-\d{1,2}/.test( dateString ) ) {
                var auxDate = dateString.split( '-' );
                newDate._year  = +auxDate[ 0 ];
                newDate._month = +auxDate[ 1 ] - 1;
                newDate._day   = +auxDate[ 2 ];
            }

            this._setDate( newDate );

            this.monthView();
        },

        _setDate: function (newDate) {
            newDate = this._fitDateToRange(newDate);

            if (this._day !== undefined) {
                if (this._dateCmp(this, newDate) === 0) { return; }
            }

            var yearChanged = this._year !== newDate._year;
            var monthChanged = this._month !== newDate._month || yearChanged;

            this._year = newDate._year;
            this._month = newDate._month;
            this._day = newDate._day;

            this._updateTopBar();

            var changeEvent = {
                date: this.getDate(),
                year: this._year,
                month: this._month,
                day: this._day
            };

            if (typeof this._options.onSetDate === 'function') {
                this._options.onSetDate.call(this, changeEvent);
            }

            /* [3.1.0] deprecate onSelectYear, onSelectMonth. onSetDate is enough. */
            var self = this;
            function callDeprecatedUserCallback(callback) {
                if (typeof callback === 'function') {
                    Ink.warn('The Ink.UI.Calendar (and thus, Ink.UI.DatePicker) callbacks "onSelectMonth" and "onSelectYear" are eventually going to be deprecated.');
                    callback.call(self, self, changeEvent);
                }
            }

            if (yearChanged) {
                callDeprecatedUserCallback(this._options.onSelectYear);
            }
            if (monthChanged) {
                callDeprecatedUserCallback(this._options.onSelectMonth);
            }
        },

        /**
         * Called when "next" or "previous" button is clicked.
         *
         * @method _onNextPrevClicked
         *
         * @param dateFragment "Year", "Decade", or "Month", depending on current view
         * @param nextOrPrev {Number} +1 or -1
         **/
        _onNextPrevClicked: function (dateFragment, increment) {
            var newDate = this._tryLeap(dateFragment, increment);

            if (!newDate) { return; }

            this._setDate(newDate);

            if (dateFragment === '_month') {
                this.monthView();
            } else if (dateFragment === '_year') {
                this.yearView();
            } else if (dateFragment === '_decade') {
                this.decadeView();
            }
        },

        /**
         * Checks if a date is between the valid range.
         * Starts by checking if the date passed is valid. If not, will fallback to the 'today' date.
         * Then checks if the all params are inside of the date range specified. If not, it will fallback to the nearest valid date (either Min or Max).
         *
         * @method _fitDateToRange
         * @param  {Number} year  Year with 4 digits (yyyy)
         * @param  {Number} month Month
         * @param  {Number} day   Day
         * @return {Array}       Array with the final processed date.
         * @private
         */
        _fitDateToRange: function( date ) {
            if ( !this._isValidDate( date ) ) {
                date = dateishFromDate(new Date());
            }

            if (this._dateCmp(date, this._min) === -1) {
                return Ink.extendObj({}, this._min);
            } else if (this._dateCmp(date, this._max) === 1) {
                return Ink.extendObj({}, this._max);
            }

            return Ink.extendObj({}, date);  // date is okay already, just copy it.
        },

        /**
         * Checks if a date is valid
         *
         * @method _isValidDate
         * @param {Dateish} date
         * @private
         * @return {Boolean} True if the date is valid, false otherwise
         */
        _isValidDate: function(date){
            var yearRegExp = /^\d{4}$/;
            var validOneOrTwo = /^\d{1,2}$/;
            return (
                yearRegExp.test(date._year)     &&
                validOneOrTwo.test(date._month) &&
                validOneOrTwo.test(date._day)   &&
                +date._month + 1 >= 1  &&
                +date._month + 1 <= 12 &&
                +date._day       >= 1  &&
                +date._day       <= this._daysInMonth(date._year, date._month)
            );
        },

        _acceptableDay: function (date) {
            return this._acceptableDateComponent(date, 'validDayFn') && this._acceptableMonth(date);
        },

        _acceptableMonth: function (date) {
            return this._acceptableDateComponent(date, 'validMonthFn') && this._acceptableYear(date);
        },

        _acceptableYear: function (date) {
            return this._acceptableDateComponent(date, 'validYearFn');
        },

        /** DRY base for the above 2 functions */
        _acceptableDateComponent: function (date, userCb) {
            if (this._options[userCb]) {
                return !!this._callUserCallback(this._options[userCb], date);
            } else {
                return this._dateWithinRange(date);
            }
        },

        /**
         * Function that returns the number of days on a given month on a given year
         *
         * @method _daysInMonth
         * @param {Number} _y - year
         * @param {Number} _m - month
         * @private
         * @return {Number} The number of days on a given month on a given year
         */
        _daysInMonth: function(_y,_m){
            return (new Date(_y, _m + 1, 0)).getDate();
        },

        /**
         * DRY base for a function which tries to get the next or previous valid year or month.
         *
         * It checks if we can go forward by using _dateCmp with atomic
         * precision (this means, {_year} for leaping years, and
         * {_year, month} for leaping months), then it tries to get the
         * result from the user-supplied callback (nextDateFn or prevDateFn),
         * and when this is not present, advance the date forward using the
         * `advancer` callback.
         */
        _tryLeap: function (atomName, increment) {
            var date = dateishCopy(this);
            var before = dateishCopy(date);

            var boundary = increment > 0 ? this._max : this._min;

            var directionName = increment > 0 ? 'next' : 'prev';

            // Check if we're by the boundary of min/max year/month
            if (this._dateCmpUntil(date, boundary, atomName) === 0) {
                return null;  // We're already at the boundary. Bail.
            }

            var leapUserCb = this._options[directionName + 'ValidDateFn'];
            if (leapUserCb) {
                return this._callUserCallbackDate(leapUserCb, date);
            } else {
                if (atomName === '_decade') {
                    increment *= 10;
                    date._year += increment;
                    date._year = roundDecade(date._year);
                } else {
                    date[atomName] += increment;
                    date = dateishFromDate(new Date(date._year, date._month, date._day ));
                }
            }

            date = this._fitDateToRange(date);

            if (this._dateCmpUntil(date, before, atomName) === 0) {
                return null;
            }

            return date;
        },

        _callUserCallback: function (cb, date) {
            return cb.call(this, date._year, date._month + 1, date._day);
        },

        _callUserCallbackDate: function (cb, date) {
            var ret = this._callUserCallback(cb, date);
            return ret ? dateishFromDate(ret) : null;
        },

        /**
         * Sets the range of dates allowed to be selected in the Date Picker
         *
         * @method _setMinMax
         * @param {String} dateRange Two dates separated by a ':'. Example: 2013-01-01:2013-12-12
         * @private
         */
        _setMinMax: function( dateRange ) {
            var self = this;

            var noMinLimit = {
                _year: -Number.MAX_VALUE,
                _month: 0,
                _day: 1
            };

            var noMaxLimit = {
                _year: Number.MAX_VALUE,
                _month: 11,
                _day: 31
            };

            function noLimits() {
                self._min = noMinLimit;
                self._max = noMaxLimit;
            }

            if (!dateRange) { return noLimits(); }

            var dates = dateRange.split( ':' );

            InkArray.each([
                        {name: '_min', date: dates[0], noLim: noMinLimit},
                        {name: '_max', date: dates[1], noLim: noMaxLimit}
                    ], Ink.bind(function (data) {

                var lim = data.noLim;

                if ( data.date.toUpperCase() === 'NOW' ) {
                    var now = new Date();
                    lim = dateishFromDate(now);
                } else if (data.date.toUpperCase() === 'EVER') {
                    lim = data.noLim;
                } else if ( data.date.split(/-/).length === 3 ) {
                    lim = dateishFromDate(new Date(data.date));

                    lim._month = clamp(lim._month, 0, 11);
                    lim._day = clamp(lim._day, 1, this._daysInMonth( lim._year, lim._month));
                }

                this[data.name] = lim;
            }, this));

            // Should be equal, or min should be smaller
            var valid = this._dateCmp(this._max, this._min) !== -1;

            if (!valid) {
                noLimits();
            }
        },

        /**
         * Checks whether a date is within the valid date range
         * @method _dateWithinRange
         * @param year
         * @param month
         * @param day
         * @return {Boolean}
         * @private
         */
        _dateWithinRange: function (date) {
            date = date || this;

            return (this._dateCmp(date, this._max) <= 0 &&
                    this._dateCmp(date, this._min) >= 0);
        },

        _dateCmp: function (self, oth) {
            return this._dateCmpUntil(self, oth, '_day');
        },

        /**
         * _dateCmp with varied precision. You can compare down to the day field, or, just to the month.
         * // the following two dates are considered equal because we asked
         * // _dateCmpUntil to just check up to the years.
         *
         * _dateCmpUntil({_year: 2000, _month: 10}, {_year: 2000, _month: 11}, '_year') === 0
         */
        _dateCmpUntil: function (self, oth, depth) {
            var props = ['_decade', '_year', '_month', '_day'];
            var i = -1;

            do {
                i++;
                if (props[i] !== '_decade') {
                    if      (self[props[i]] > oth[props[i]]) { return 1; }
                    else if (self[props[i]] < oth[props[i]]) { return -1; }
                } else {
                    if      (roundDecade(self) > roundDecade(oth)) { return 1; }
                    else if (roundDecade(self) < roundDecade(oth)) { return -1; }
                }
            } while (props[i] !== depth &&
                    self[props[i + 1]] !== undefined && oth[props[i + 1]] !== undefined);

            return 0;
        },

        /**
         * Remove the datepicker from the DOM and clean up the related events
         *
         * @method destroy
         **/
        destroy: function () {
            Event.off(this._element);
            InkElement.remove(this._element);
        }
    };


    Common.createUIComponent(Calendar);

    return Calendar;
});
