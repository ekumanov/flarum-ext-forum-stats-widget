import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Forum from 'flarum/common/models/Forum';
import Model from 'flarum/common/Model';
import Avatar from 'flarum/common/components/Avatar';
import username from 'flarum/common/helpers/username';
import formatNumber from 'flarum/common/utils/formatNumber';
import Link from 'flarum/common/components/Link';
import Tooltip from 'flarum/common/components/Tooltip';
import IndexPage from 'flarum/forum/components/IndexPage';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import Component from 'flarum/common/Component';

class CompactForumWidget extends Component {
    oninit(vnode) {
        super.oninit(vnode);
        this.expanded = false;
        this.boundDocClick = this.onDocumentClick.bind(this);
    }

    oncreate(vnode) {
        super.oncreate(vnode);
        document.addEventListener('click', this.boundDocClick);
    }

    onremove(vnode) {
        super.onremove(vnode);
        document.removeEventListener('click', this.boundDocClick);
    }

    onDocumentClick(e) {
        if (!this.expanded) return;
        if (this.element && this.element.contains(e.target)) return;
        this.expanded = false;
        m.redraw();
    }

    view() {
        const isFullWidth = this.attrs.layout === 'full-width';
        const viewport = this.attrs.viewport;
        const isMobile = viewport === 'mobile';
        const isDesktop = viewport === 'desktop';
        const isDesktopFullWidth = isFullWidth && isDesktop;

        const showToggle = app.forum.attribute('forumStatsShowToggle') !== false;
        const expandedPanelWidth = isDesktopFullWidth
            ? (app.forum.attribute('forumStatsExpandedPanelWidth') || 'full-bar')
            : 'full-bar';
        const isOnlineCellMode = expandedPanelWidth === 'online-cell';

        const canViewOnline = app.forum.attribute('canViewOnlineUsers');
        const users = canViewOnline ? (app.forum.onlineUsers() || []) : [];
        const totalOnline = canViewOnline ? (app.forum.attribute('totalOnlineUsers') || 0) : 0;
        const hiddenOnline = canViewOnline ? (app.forum.attribute('hiddenOnlineUsers') || 0) : 0;

        const discussionsCount = app.forum.attribute('forumStatsDiscussionsCount');
        const postsCount = app.forum.attribute('forumStatsPostsCount');
        const usersCount = app.forum.attribute('forumStatsUsersCount');

        let latestUser = null;
        try {
            latestUser = app.forum.latestRegisteredUser();
        } catch (e) {}

        const hasAnyStat = discussionsCount != null || postsCount != null || usersCount != null;
        const hasOnline = canViewOnline && totalOnline > 0;
        const hasAnything = hasOnline || hasAnyStat;

        if (!hasAnything) return m('div');

        const overflowCount = Math.max(0, totalOnline - users.length - hiddenOnline);
        const hasExpandableContent = canViewOnline || latestUser;

        // Toggle is placed inline (inside online cell wrapper) on:
        // - Mobile (always, when online users are shown)
        // - Desktop online-cell mode (toggle anchors the dropdown to the online cell)
        // Falls back to bar-end if no online users are shown.
        const inlineToggle = hasOnline && (isMobile || (isDesktopFullWidth && isOnlineCellMode));

        const isInToolbar = this.attrs.position === 'inside-toolbar';

        const classNames = [
            this.expanded ? 'CompactWidget--expanded' : '',
            isFullWidth ? 'CompactWidget--fullWidth' : '',
            isInToolbar ? 'CompactWidget--inToolbar' : '',
            isDesktop ? 'CompactWidget--desktop' : '',
            isMobile ? 'CompactWidget--mobile' : '',
            isDesktopFullWidth && !isOnlineCellMode ? 'CompactWidget--fullBar' : '',
            isDesktopFullWidth && isOnlineCellMode ? 'CompactWidget--onlineCell' : '',
        ].filter(Boolean).join(' ');

        const pre = 'ekumanov-forum-widgets.forum.stats.';

        // buildStat: creates a stat element with optional tooltip.
        // forceTooltip: use tooltip even in full-width desktop mode (for non-online stats in online-cell mode).
        const buildStat = (icon, value, tooltipKey, labelKey, extraClass, forceTooltip) => {
            const inlineLabel = app.translator.trans(labelKey, { count: value });
            const tooltipText = app.translator.trans(tooltipKey);
            const accessibleLabel = formatNumber(value) + ' ' + inlineLabel;
            const useTooltip = !isDesktopFullWidth || forceTooltip;
            const statEl = m('span.CompactWidget-stat' + (extraClass || ''), {
                'aria-label': accessibleLabel,
                role: 'text',
            }, [
                m('i.fa-solid.' + icon, { 'aria-hidden': 'true' }),
                m('span', formatNumber(value)),
                isFullWidth ? m('span.CompactWidget-statLabel', inlineLabel) : null,
            ]);
            return useTooltip ? m(Tooltip, { text: tooltipText }, statEl) : statEl;
        };

        // Toggle button (shared between inline and bar-end placements)
        const toggleButton = hasExpandableContent && showToggle
            ? m('button.CompactWidget-toggle.Button.Button--icon.Button--link', {
                onclick: (e) => { e.stopPropagation(); this.expanded = !this.expanded; m.redraw(); },
                'aria-label': this.expanded
                    ? app.translator.trans('ekumanov-forum-widgets.forum.aria.collapse_details')
                    : app.translator.trans('ekumanov-forum-widgets.forum.aria.expand_details'),
                'aria-expanded': String(this.expanded),
                tabIndex: (!inlineToggle && isDesktopFullWidth) ? '-1' : '0',
            }, m('i.fas', { className: this.expanded ? 'fa-chevron-up' : 'fa-chevron-down', 'aria-hidden': 'true' }))
            : null;

        // Expanded panel content (positioning differs by mode — rendered in different places below)
        const expandedPanel = this.expanded
            ? m('.CompactWidget-expanded', {
                onclick: (e) => e.stopPropagation(),
                role: 'region',
                'aria-label': app.translator.trans('ekumanov-forum-widgets.forum.aria.details_panel'),
            }, [
                canViewOnline && (users.length > 0 || hiddenOnline > 0 || overflowCount > 0)
                    ? m('.CompactWidget-expandedSection', [
                        m('.CompactWidget-expandedLabel', { id: 'compact-widget-online' }, [
                            m('.CompactWidget-greenDot', { 'aria-hidden': 'true' }),
                            ' ',
                            app.translator.trans('ekumanov-forum-widgets.forum.online_users.title'),
                            ' (' + totalOnline + ')',
                        ]),
                        m('.CompactWidget-expandedUsersList', {
                            role: 'list',
                            'aria-labelledby': 'compact-widget-online',
                        }, [
                            users.map(user =>
                                m(Link, {
                                    href: app.route('user', { username: user.slug() }),
                                    className: 'CompactWidget-expandedUser',
                                    key: user.id(),
                                    role: 'listitem',
                                }, [
                                    m(Avatar, { user: user }),
                                    m('span.CompactWidget-expandedUsername', user.displayName()),
                                ])
                            ),
                            overflowCount > 0
                                ? m('.CompactWidget-expandedUser.CompactWidget-expandedUser--overflow', {
                                    role: 'listitem',
                                    'aria-label': app.translator.trans('ekumanov-forum-widgets.forum.aria.overflow_users', { count: overflowCount }),
                                }, [
                                    m('span.CompactWidget-overflowAvatar', { 'aria-hidden': 'true' }, '+' + overflowCount),
                                    m('span.CompactWidget-expandedUsername.CompactWidget-expandedUsername--muted',
                                        app.translator.trans('ekumanov-forum-widgets.forum.online_users.overflow_more')
                                    ),
                                ])
                                : null,
                            hiddenOnline > 0
                                ? m('.CompactWidget-expandedUser.CompactWidget-expandedUser--hidden', {
                                    role: 'listitem',
                                    'aria-label': hiddenOnline + ' ' + app.translator.trans('ekumanov-forum-widgets.forum.online_users.hidden_users', { count: hiddenOnline }),
                                }, [
                                    m('span.CompactWidget-hiddenAvatar', { 'aria-hidden': 'true' }, hiddenOnline),
                                    m('span.CompactWidget-expandedUsername.CompactWidget-expandedUsername--muted',
                                        app.translator.trans('ekumanov-forum-widgets.forum.online_users.hidden_users', { count: hiddenOnline })
                                    ),
                                ])
                                : null,
                        ]),
                    ])
                    : null,

                latestUser
                    ? m('.CompactWidget-expandedSection', [
                        m('.CompactWidget-expandedLabel', { id: 'compact-widget-latest' },
                            app.translator.trans('ekumanov-forum-widgets.forum.stats.latest_registration')
                        ),
                        m(Link, {
                            href: app.route('user', { username: latestUser.slug() }),
                            className: 'CompactWidget-expandedUser',
                            'aria-labelledby': 'compact-widget-latest',
                        }, [
                            m(Avatar, { user: latestUser }),
                            m('span.CompactWidget-expandedUsername', username(latestUser)),
                        ]),
                    ])
                    : null,
            ])
            : null;

        // Build stats in order: online (1), users (2), discussions (3), posts (4)
        const stats = [];

        // Online users — first. On mobile and desktop online-cell mode, wraps the toggle
        // and (in online-cell mode) also the expanded panel.
        if (hasOnline) {
            const onlineStat = buildStat('fa-user', totalOnline, pre + 'tooltip_online', pre + 'label_online', '.CompactWidget-stat--online');

            if (inlineToggle) {
                // Online cell wrapper: holds the stat + toggle side by side.
                // In desktop online-cell mode it's also the click target for expanding.
                const cellClickable = isDesktopFullWidth && isOnlineCellMode && hasExpandableContent;
                stats.push(m('.CompactWidget-onlineWrapper', {
                    onclick: cellClickable
                        ? (e) => { e.stopPropagation(); this.expanded = !this.expanded; m.redraw(); }
                        : undefined,
                    onkeydown: cellClickable
                        ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.expanded = !this.expanded; m.redraw(); } }
                        : undefined,
                    role: cellClickable ? 'button' : undefined,
                    tabIndex: cellClickable ? '0' : undefined,
                    'aria-expanded': cellClickable ? String(this.expanded) : undefined,
                }, [
                    onlineStat,
                    toggleButton,
                    // Panel inside wrapper only in desktop online-cell mode
                    isDesktopFullWidth && isOnlineCellMode ? expandedPanel : null,
                ]));
            } else {
                stats.push(onlineStat);
            }
        }

        // Users count — second. In online-cell mode, other stats get a tooltip.
        if (usersCount != null) {
            stats.push(buildStat('fa-user', usersCount, pre + 'tooltip_users', pre + 'label_users', '', isOnlineCellMode));
        }
        // Discussions count — third
        if (discussionsCount != null) {
            stats.push(buildStat('fa-comments', discussionsCount, pre + 'tooltip_discussions', pre + 'label_discussions', '', isOnlineCellMode));
        }
        // Posts count — fourth
        if (postsCount != null) {
            stats.push(buildStat('fa-comment', postsCount, pre + 'tooltip_posts', pre + 'label_posts', '', isOnlineCellMode));
        }

        // Bar is clickable in full-bar desktop mode only
        const barClickable = isDesktopFullWidth && !isOnlineCellMode && hasExpandableContent;

        return m('section.CompactWidget', {
            className: classNames,
            'aria-label': app.translator.trans('ekumanov-forum-widgets.forum.stats.title'),
        }, [
            m('.CompactWidget-bar', {
                onclick: barClickable
                    ? (e) => { e.stopPropagation(); this.expanded = !this.expanded; m.redraw(); }
                    : undefined,
                onkeydown: barClickable
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.expanded = !this.expanded; m.redraw(); } }
                    : undefined,
                role: barClickable ? 'button' : undefined,
                tabIndex: barClickable ? '0' : undefined,
                'aria-expanded': barClickable ? String(this.expanded) : undefined,
            }, [
                m('.CompactWidget-stats', stats),
                // End-of-bar toggle: full-bar desktop mode or sidebar/mobile when no online users
                !inlineToggle ? toggleButton : null,
            ]),

            // Expanded panel at bar level for full-bar desktop and mobile
            // (online-cell desktop renders panel inside the online wrapper above)
            !isOnlineCellMode ? expandedPanel : null,
        ]);
    }
}

app.initializers.add('ekumanov/forum-widgets', () => {
    Forum.prototype.onlineUsers = Model.hasMany('onlineUsers');
    Forum.prototype.totalOnlineUsers = Model.attribute('totalOnlineUsers');
    Forum.prototype.hiddenOnlineUsers = Model.attribute('hiddenOnlineUsers');
    Forum.prototype.canViewOnlineUsers = Model.attribute('canViewOnlineUsers');
    Forum.prototype.latestRegisteredUser = Model.hasOne('latestRegisteredUser');

    // Helper: read settings lazily (app.forum is not available at initializer time)
    const getLayout = () => app.forum.attribute('forumStatsWidgetLayout') || 'full-width';
    const getDesktopPos = () => app.forum.attribute('forumStatsBarPositionDesktop') || 'inside-toolbar';
    const getMobilePos = () => app.forum.attribute('forumStatsBarPositionMobile') || 'above-toolbar';
    const contentPriority = (pos) => pos === 'above-toolbar' ? 101 : 95;

    // Desktop: classic sidebar layout
    extend(IndexSidebar.prototype, 'items', function (items) {
        if (getLayout() !== 'classic') return;
        const routeName = app.current && app.current.get('routeName');
        if (routeName !== 'index') return;
        const position = app.forum.attribute('forumStatsWidgetPosition') || -10;
        items.add('compactForumWidget', m(CompactForumWidget, { layout: 'classic', viewport: 'desktop' }), position);
    });

    // Desktop: full-width inside toolbar
    extend(IndexPage.prototype, 'toolbarItems', function (items) {
        const routeName = app.current && app.current.get('routeName');
        if (routeName !== 'index') return;
        if (getLayout() !== 'classic' && getDesktopPos() === 'inside-toolbar') {
            items.add('compactForumWidget', m(CompactForumWidget, { layout: 'full-width', position: 'inside-toolbar', viewport: 'desktop' }), 95);
        }
    });

    // Desktop: full-width above/below toolbar + Mobile: above/below toolbar
    extend(IndexPage.prototype, 'contentItems', function (items) {
        const routeName = app.current && app.current.get('routeName');
        if (routeName !== 'index') return;

        if (getLayout() !== 'classic' && getDesktopPos() !== 'inside-toolbar') {
            items.add('compactForumWidget', m(CompactForumWidget, { layout: 'full-width', viewport: 'desktop' }), contentPriority(getDesktopPos()));
        }
        items.add('compactForumWidgetMobile', m(CompactForumWidget, { layout: 'full-width', viewport: 'mobile' }), contentPriority(getMobilePos()));
    });
});
