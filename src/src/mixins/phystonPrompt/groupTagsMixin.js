import common from "@/utils/common"
import {ref} from "vue"

export default {
    data() {
        return {
            groupTagsActive: '',
            subGroupTagsActive: '',
            groupTagsProcessed: [],
            extraNetworksRefreshing: false,
        }
    },
    watch: {
        groupTags: {
            handler() {
                this.genGroup()
                if (!this.groupTagsActive || !this.subGroupTagsActive) {
                    this.groupTagsActive = 'favorite'
                    this.subGroupTagsActive = 'favorite-' + this.favoriteKey
                    /*for (let item of this.groupTags) {
                        this.groupTagsActive = item.tabKey
                        for (let group of item.groups) {
                            if (group.type && group.typ == 'wrap') continue
                            this.subGroupTagsActive = group.tabKey
                            break
                        }
                        break
                    }*/
                }
                this._setGroupTagItemWidth()
            },
            deep: true,
            immediate: true,
        },
        favorites: {
            handler() {
                this.genGroup()
            },
            deep: true,
            immediate: true,
        },
        extraNetworks: {
            handler() {
                this.genGroup()
            },
            deep: true,
            immediate: true,
        }
    },
    mounted() {
        this.gradioAPI.getData('groupTagsActive-' + this.name).then((data) => {
            if (data !== null && typeof data === 'object') {
                this.groupTagsActive = data.groupTagsActive
                this.subGroupTagsActive = data.subGroupTagsActive
            }
        })
    },
    methods: {
        genGroup() {
            let processed = []
            let favoriteGroup = {
                name: this.getLang('favorite'),
                tabKey: 'favorite',
                type: 'favorite',
                groups: [],
            }
            this.getCurrentTypeFavorites().forEach(item => {
                let subGroup = {
                    color: '',
                    name: this.getLang(item.name),
                    tabKey: 'favorite-' + item.key,
                    type: 'favorite',
                    tags: {},
                    ori: {},
                }
                item.list.forEach(favorite => {
                    subGroup.tags[favorite.prompt] = favorite.name == '' ? favorite.prompt : favorite.name
                    subGroup.ori[favorite.prompt] = favorite
                })
                favoriteGroup.groups.push(subGroup)
            })
            processed.push(favoriteGroup)

            if (!this.$appMode) {
                let extraNetworksGroup = {
                    name: 'Extra Networks',
                    tabKey: 'extraNetworks',
                    type: 'extraNetworks',
                    groups: [],
                }
                this.extraNetworks.forEach(extraNetwork => {
                    // if (extraNetwork.name === 'checkpoints') return
                    let subGroup = {
                        color: '',
                        name: extraNetwork.title,
                        tabKey: 'extraNetworks-' + extraNetwork.name,
                        type: 'extraNetworks',
                        subType: extraNetwork.name,
                        tags: {},
                        datas: [],
                    }
                    extraNetwork.items.forEach(item => {
                        subGroup.datas.push(item)
                    })
                    extraNetworksGroup.groups.push(subGroup)
                    extraNetwork.items.forEach(item => {
                        item.dirnameFormat = item.dirname.replaceAll('\\', '/')
                    })
                    let prefixPath = common.getSamePrefixPath([...new Set(extraNetwork.items.map(item => item.dirnameFormat))])
                    let baseDirs = []
                    extraNetwork.items.forEach(item => {
                        let baseDirname = item.dirnameFormat.replace(prefixPath, '')
                        if (baseDirname === '') baseDirname = '@root'
                        baseDirname = baseDirname.replace(/^\//, '')
                        baseDirs.push(baseDirname)
                        item.base_dirname = baseDirname
                    })
                    baseDirs = [...new Set(baseDirs)]

                    if (baseDirs.length > 1) {
                        baseDirs.forEach(dir => {
                            let subDirGroup = {
                                color: '',
                                name: dir,
                                tabKey: 'extraNetworks-' + extraNetwork.name + '-' + dir,
                                type: 'extraNetworks',
                                subType: extraNetwork.name,
                                tags: {},
                                datas: [],
                            }
                            extraNetwork.items.forEach(item => {
                                if (item.base_dirname === dir) {
                                    subDirGroup.datas.push(item)
                                }
                            })
                            extraNetworksGroup.groups.push(subDirGroup)
                        })
                    }
                    extraNetworksGroup.groups.push({
                        type: 'wrap',
                    })
                })
                processed.push(extraNetworksGroup)
            }

            processed = processed.concat(this.groupTags)
            this.groupTagsProcessed = processed
        },
        saveGroupActive() {
            this.gradioAPI.setData('groupTagsActive-' + this.name, {
                groupTagsActive: this.groupTagsActive,
                subGroupTagsActive: this.subGroupTagsActive,
            })
        },
        activeGroupTab(index) {
            this.groupTagsActive = this.groupTagsProcessed[index].tabKey
            this.subGroupTagsActive = this.groupTagsProcessed[index].groups[0].tabKey
            this.saveGroupActive()
            let scrollLeft = this.$refs.groupTabsHeader.children[index].offsetLeft - this.$refs.groupTabsHeader.offsetWidth / 2 + this.$refs.groupTabsHeader.children[index].offsetWidth / 2
            this.$refs.groupTabsHeader.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            })
            this._setGroupTagItemWidth()
        },
        activeSubGroupTab(index, subIndex) {
            this.subGroupTagsActive = this.groupTagsProcessed[index].groups[subIndex].tabKey
            this.saveGroupActive()
            this._setGroupTagItemWidth()
        },
        _setGroupTagItemWidth() {
            // this.$refs.groupTagItem
            this.$nextTick(() => {
                if (!this.$refs.groupTagItem) return
                this.$refs.groupTagItem.forEach((item, index) => {
                    item.style.width = 'auto'
                })
                let maxWidth = 0
                this.$refs.groupTagItem.forEach((item, index) => {
                    maxWidth = Math.max(maxWidth, item.offsetWidth)
                })
                if (maxWidth > 0) {
                    this.$refs.groupTagItem.forEach((item, index) => {
                        item.style.width = maxWidth + 'px'
                    })
                }
            })
        },
        onClickHideGroupTags() {
            this.$emit('update:hideGroupTags', !this.hideGroupTags)
        },
        onClickGroupTag(local, en, group, subGroup) {
            // 判断是否存在 tags 中
            let indexes = []
            this.tags.forEach((tag, index) => {
                if (tag.originalValue === en) {
                    indexes.push(index)
                }
            })
            if (indexes.length) {
                indexes.reverse().forEach((index) => {
                    this.tags.splice(index, 1)
                })
                this.updateTags()
            } else {
                if (group.type === 'favorite') {
                    let favorite = subGroup.ori[en]
                    this.onClickGroupTagFavorite(favorite)
                } else {
                    this._appendTag(en, local, false, -1, 'text')
                    this.updateTags()
                }
            }
        },
        onClickGroupTagFavorite(favorite) {
            favorite.tags.forEach((tag) => {
                this._appendTag(tag.value, tag.localValue, tag.disabled, -1, tag.type)
            })
            this.updateTags()
        },
        onClickGroupTagExtraNetwork(data, group, subGroup) {
            if (subGroup.subType === 'checkpoints') {
                if (data.loading) return
                data.loading = true
                let setLoading = (num) => {
                    if (num > 100) {
                        data.loading = false
                        setTimeout(this.onClickGroupExtraNetworkRefresh, 1000)
                        // console.log('超时')
                        return
                    }
                    if (opts && opts.sd_model_checkpoint) {
                        let isLoaded = false
                        let checkpoint = opts.sd_model_checkpoint
                        if (checkpoint.indexOf('['+ data.shorthash +']') > -1) {
                            isLoaded = true
                        } else {
                            checkpoint = checkpoint.replaceAll('\\', '/')
                            let baseDirname = data.baseDirname
                            if (baseDirname === '@root') baseDirname = ''
                            if (checkpoint.indexOf(baseDirname + '/' + data.basename) > -1) {
                                isLoaded = true
                            } else {
                                if (checkpoint.indexOf(data.basename) > -1) {
                                    isLoaded = true
                                }
                            }
                        }
                        if (isLoaded) {
                            data.loading = false
                            setTimeout(this.onClickGroupExtraNetworkRefresh, 1000)
                            // console.log('已加载')
                            return
                        }
                    }

                    setTimeout(setLoading, 100, num + 1)
                }
                setLoading(0)
                console.log(data)
                if (data.onclick) {
                    let e = document.createElement('div')
                    e.innerHTML = data.onclick
                    let onclick = e.textContent || e.innerText
                    // 去除左右"引号
                    onclick = onclick.replace(/^"/, '').replace(/"$/, '').trim()
                    // 去除 return
                    onclick = onclick.replace(/^return /, '').trim()
                    console.log(onclick)
                    eval(onclick)
                } else {
                    selectCheckpoint(data.basename)
                }
                return
            }
            let indexes = this._groupTagsExtraNetworkTagsIndexes(data)
            if (indexes.length) {
                indexes.reverse().forEach((index) => {
                    console.log(index)
                    this.tags.splice(index, 1)
                })
                this.updateTags()
            } else {
                let index = this._appendTag(eval(data.prompt), '', false, -1, 'text')
                if (this.autoTranslateToLocal) {
                    this.translates([index], true, false).finally(() => {
                        this.updateTags()
                    })
                } else {
                    this.updateTags()
                }
            }
        },
        getGroupTagTooltip(local, en) {
            let html = ''
            if (local && local !== en) {
                html += local + '<br/>'
            }
            html += en
            return html
        },
        getGroupTagStyle(groupName, subGroupName, value) {
            let style = {}
            let colorKey = common.getTagsColorKey(groupName, subGroupName)
            let color = ''
            if (this.groupTagsColor[colorKey]) {
                color = this.groupTagsColor[colorKey]
                if (common.isColorTransparent(color)) {
                    // 如果是纯透明，则设为空
                    color = ''
                }
            }
            if (color) {
                style = {background: color}
            }
            // 判断是否存在 tags 中
            for (let tag of this.tags) {
                if (tag.originalValue === value) {
                    style['filter'] = 'grayscale(1)'
                    break
                }
            }
            return style
        },
        _groupTagsExtraNetworkTagsIndexes(data) {
            let name = data.name
            let output_name = data.output_name || undefined
            let indexes = []
            for (let index in this.tags) {
                let tag = this.tags[index]
                if (typeof tag['type'] === 'string' && tag.type === 'wrap') continue
                let find = false
                if (tag.isLora) {
                    find = tag.loraName === name || (output_name && tag.loraName === output_name)
                } else if (tag.isLyco) {
                    find = tag.lycoName === name || (output_name && tag.lycoName === output_name)
                } else if (tag.isEmbedding) {
                    find = tag.embeddingName === name || (output_name && tag.embeddingName === output_name)
                } else {
                    find = tag.originalValue === name || (output_name && tag.originalValue === output_name)
                }
                if (find) {
                    indexes.push(index)
                }
            }
            return indexes
        },
        networkCardThumbnail(item) {
            const failed = item._fnmImageFailures || [];
            return [item.thumbnail, item.preview, item.civitai_info?.images?.[0]]
                .find(url => url && !failed.includes(url)) || this.emptyCardThumbnail();
        },
        emptyCardThumbnail() {
            return "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22160%22%20height%3D%22160%22%20viewBox%3D%220%200%20160%20160%22%3E%3Crect%20width%3D%22160%22%20height%3D%22160%22%20fill%3D%22%2330343b%22%2F%3E%3Ctext%20x%3D%2280%22%20y%3D%2280%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%20fill%3D%22%23c7cbd2%22%20font-size%3D%2215%22%20font-family%3D%22sans-serif%22%3E%E7%94%BB%E5%83%8F%E3%81%AA%E3%81%97%3C%2Ftext%3E%3C%2Fsvg%3E";
        },
        getGroupTagExtraNetworkStyle(data) {
            let indexes = this._groupTagsExtraNetworkTagsIndexes(data)
            let style = {
                width: this.extraNetworksWidth + 'px',
                height: this.extraNetworksHeight + 'px',
            }
            if (indexes.length) style['filter'] = 'grayscale(1)'
            return style
        },
        getTagsColorKey(groupName, subGroupName) {
            return common.getTagsColorKey(groupName, subGroupName)
        },
        onTagsColorChange(key) {
            this.$emit('update:groupTagsColor', this.groupTagsColor)
        },
        onClickResetTagsColor(key) {
            for (let item of this.groupTagsProcessed) {
                for (let group of item.groups) {
                    if (group.type && group.typ == 'wrap') continue
                    let key2 = common.getTagsColorKey(item.name, group.name)
                    if (key === key2) {
                        this.groupTagsColor[key] = ref(common.fitterInputColor(group.color))
                    }
                }
            }
            this.onTagsColorChange(key)
        },
        onClickClearTagsColor(key) {
            this.groupTagsColor[key] = ref('rgba(0,0,0,0)')
            this.onTagsColorChange(key)
        },
        getTagColorStyle(tag) {
            if (tag.isLora || tag.isLyco || tag.isEmbedding) return {}
            if (!this.groupTagsColorKeyCache[tag.value]) return {}
            let key = this.groupTagsColorKeyCache[tag.value]
            if (!this.groupTagsColor[key]) return {}
            let color = this.groupTagsColor[key]
            if (common.isColorTransparent(color)) return {}
            return {background: color}
        },
        onGroupExtraNetworkMouseEnter(e, name) {
            this.$emit('showExtraNetworks', e.target, name, this.onLoraPopupUseKeywords, true, 'groupTags')
        },
        onGroupExtraNetworkMouseMove() {
        },
        onGroupExtraNetworkMouseLeave() {
            this.$emit('hideExtraNetworks')
        },
        onGroupExtraNetworkImageError(extraData, event) {
            const current = event?.currentTarget?.getAttribute('src');
            if (current && current !== this.emptyCardThumbnail()) {
                extraData._fnmImageFailures = [...new Set([...(extraData._fnmImageFailures || []), current])];
            }
            // Keep upstream's expired-thumbnail fallback; also skip broken local/remote previews.
            extraData.thumbnail = null
        },
        onClickGroupExtraNetworkRefresh() {
            this.$emit('refreshExtraNetworks')
            // this.extraNetworksRefreshing = true
            // this._loadExtraNetworks().finally(() => {
            //     this.extraNetworksRefreshing = false
            // })
        },
    }
}
