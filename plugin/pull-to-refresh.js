/*
 * Pull to refresh with text and icon
 * 刷新步骤：
 * 1、+ .pull-down 下拉
 * 2、到达triggerDistance距离，- .pull-down, + .pull-up提醒放手立即刷新
 * 3、放手 -.pull-up + .pull-done 下拉动作完成， + .refreshing,正在刷新
 * 4、刷新完成 - .refreshing, +.refreshed
 * 5、1s后- .pull-done,返回顶部
 * 6、移除refreshed
 */
+function ($) {
    'use strict';
    /**
     * $.PullToRefresh(selector,callback);
     * @param {selector} string 刷新目标
     * @param {callback} function 状态“正在刷新”回调函数
     **/
    var PullToRefresh = function (selector, onRefresh) {
        this.container = $(selector);
        this.onRefresh = $.proxy(onRefresh, this.container[0]);
        this.init();
    };

    PullToRefresh.prototype = {
        init: function () {
            var container = this.container;
            container.addClass('pull-to-refresh-content').prepend('<div class="pull-to-refresh-layer">' +
                '<div class="pull-to-refresh-arrow pull-to-refresh-down"><i></i><span>下拉刷新</span></div>' +
                '<div class="pull-to-refresh-arrow pull-to-refresh-up"><i></i><span>释放立即刷新</span></div>' +
                '<div class="pull-to-refresh-preloader"><i class="preloader"></i><span>正在刷新...</span></div>' +
                '<div class="pull-to-refresh-done"><i></i><span>刷新完成</span></div>' +
            '</div>');
            this.attachEvents();
        },
        attachEvents: function () {
            var ptr = this,
                container = ptr.container;

            var isTouched, isMoved, touchesStart = {},
               isScrolling, touchesDiff, touchStartTime, refresh = false,
               useTranslate = false,
               startTranslate = 0,
               translate, scrollTop, wasScrolled, triggerDistance, dynamicTriggerDistance;

            // Define trigger distance
            if (container.attr('data-ptr-distance')) {
                dynamicTriggerDistance = true;
            } else {
                triggerDistance = 44;
            }

            function handleTouchStart(e) {
                if (isTouched) {
                    if ($.device.android) {
                        if ('targetTouches' in e && e.targetTouches.length > 1) return;
                    } else return;
                }

                isMoved = false;
                isTouched = true;
                isScrolling = undefined;
                wasScrolled = undefined;
                var position = $.getTouchPosition(e);
                touchesStart.x = position.x;
                touchesStart.y = position.y;
                touchStartTime = (new Date()).getTime();
            }

            function handleTouchMove(e) {
                if (!isTouched) return;
                var position = $.getTouchPosition(e);
                var pageX = position.x;
                var pageY = position.y;
                if (typeof isScrolling === 'undefined') {
                    isScrolling = !!(isScrolling || Math.abs(pageY - touchesStart.y) > Math.abs(pageX - touchesStart.x));
                }
                if (!isScrolling) {
                    isTouched = false;
                    return;
                }

                scrollTop = container[0].scrollTop;
                if (typeof wasScrolled === 'undefined' && scrollTop !== 0) wasScrolled = true;

                if (!isMoved) {
                    container.removeClass('transitioning');
                    if (scrollTop > container[0].offsetHeight) {
                        isTouched = false;
                        return;
                    }
                    if (dynamicTriggerDistance) {
                        triggerDistance = container.attr('data-ptr-distance');
                        if (triggerDistance.indexOf('%') >= 0) triggerDistance = container[0].offsetHeight * parseInt(triggerDistance, 10) / 100;
                    }
                    startTranslate = container.hasClass('pull-done') ? triggerDistance : 0;
                    if (container[0].scrollHeight === container[0].offsetHeight || !$.os.ios) {
                        useTranslate = true;
                    } else {
                        useTranslate = false;
                    }
                    useTranslate = true;
                }
                isMoved = true;
                touchesDiff = pageY - touchesStart.y;

                if (touchesDiff > 0 && scrollTop <= 0 || scrollTop < 0) {
                    // iOS 8 fix
                    if ($.os.ios && parseInt($.os.version.split('.')[0], 10) > 7 && scrollTop === 0 && !wasScrolled) useTranslate = true;

                    if (useTranslate) {
                        e.preventDefault();
                        translate = (Math.pow(touchesDiff, 0.85) + startTranslate);
                        container.transform('translate3d(0,' + translate + 'px,0)');
                    } else { }

                    if (container.hasClass('pull-done') || container.hasClass('refreshed')) {
                        refresh = false;
                        return;
                    } else if ((useTranslate && Math.pow(touchesDiff, 0.85) > triggerDistance) || (!useTranslate && touchesDiff >= triggerDistance * 2)) {
                        refresh = true;
                        container.removeClass('pull-down').addClass('pull-up');
                    } else {
                        refresh = false;
                        container.removeClass('pull-up').addClass('pull-down');
                    }
                } else {
                    container.removeClass('pull-up pull-down');
                    refresh = false;
                    return;
                }
            }

            function handleTouchEnd() {
                if (!isTouched || !isMoved) {
                    isTouched = false;
                    isMoved = false;
                    return;
                }
                if (translate) {
                    container.addClass('transitioning');
                    translate = 0;
                }
                container.transform('');
                if (refresh) {
                    container.removeClass('pull-up').addClass('pull-done refreshing');
                    ptr.onRefresh();
                } else {
                    container.transitionEnd(function () {
                        container.removeClass('transitioning pull-down');
                    });
                }
                isTouched = false;
                isMoved = false;
            }

            // Attach Events
            container.on($.touchEvents.start, handleTouchStart);
            container.on($.touchEvents.move, handleTouchMove);
            container.on($.touchEvents.end, handleTouchEnd);

            // Destroy
            ptr.destroy = function () {
                container.off($.touchEvents.start, handleTouchStart);
                container.off($.touchEvents.move, handleTouchMove);
                container.off($.touchEvents.end, handleTouchEnd);
            };
        },
        done: function () {
            var ptr = this, container = ptr.container;

            container.removeClass('refreshing').addClass('refreshed');
            setTimeout(function () {
                container
                    .removeClass('pull-done')
                    .addClass('transitioning')
                    .transform('')
                    .transitionEnd(function () {
                        container.removeClass('transitioning refreshed error');
                    });
            }, 1000);
        },
        trigger: function () {
            var ptr = this, container = ptr.container;

            if (container.hasClass('pull-done')) return;
            container.addClass('transitioning pull-done refreshing');
            ptr.onRefresh();
        }
    };

    $.PullToRefresh = PullToRefresh;
}($);
