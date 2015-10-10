#ifndef __TRIE_HPP
#define __TRIE_HPP

#include <iostream>
#include <string>
#include <map>
#include <list>
#include <stdexcept>

#include <json.hpp>
#include <utf8.hpp>

template <class Value>
class UnicodeTrie {
public:
    std::map<Utf8::CodePoint, UnicodeTrie> children;
    
    bool has_value;
    Value value;

    typedef typename std::map<Utf8::CodePoint, UnicodeTrie<Value> >::const_iterator const_iterator;

    void insert(std::string encoded_key, Value value, bool replace = false) {
        Utf8::String key = Utf8::decode(encoded_key.c_str());
        Utf8::String::const_iterator itr = key.begin();
        UnicodeTrie<Value> &where = lookup_subtree(itr, key.end());
        where.insert_subtree(itr, key.end(), value, replace);
    }
    
    const Value *lookup(std::string encoded_key) {
        Utf8::String key = Utf8::decode(encoded_key.c_str());
        Utf8::String::const_iterator itr = key.begin();
        UnicodeTrie<Value> &where = lookup_subtree(itr, key.end());
        if (itr != key.end() || !where.has_value) return NULL;
        return &(where.value);
    }
    
    const Value &get(std::string key) {
        const Value *s = lookup(key);
        if (s == NULL) throw std::runtime_error("not found");
        return *s;
    }
    
    UnicodeTrie<Value>() : has_value(false) {}
    
private:
    typedef typename std::map<Utf8::CodePoint, UnicodeTrie<Value> >::iterator iterator;

    UnicodeTrie<Value> &lookup_subtree(
        Utf8::String::const_iterator &key, 
        Utf8::String::const_iterator key_end) {
        
        if (key == key_end) return *this;
        
        iterator itr = children.find(*key);
        if (itr != children.end()) {
            key++;
            return itr->second.lookup_subtree(key, key_end);
        }
        return *this;
    }
    
    void insert_subtree(
        Utf8::String::const_iterator key,
        Utf8::String::const_iterator key_end,
        const Value &new_v, bool replace) {
        
        if (key == key_end) {
            if (!replace && has_value)
                throw std::runtime_error("key already exists in trie");
            value = new_v;
            has_value = true;
            return;
        }
        
        children[*key] = UnicodeTrie<Value>();
        children.find(*key)->second.insert_subtree(key+1, key_end, new_v, replace);
    }
};

template <class Value>
class StringTrie {
public:
    typedef std::pair<std::string, StringTrie<Value> > KeyValuePair;
    std::list<KeyValuePair> children;
    typedef typename std::list<KeyValuePair>::const_iterator const_iterator;
    
    Value value;
    bool has_value;
    int total_nodes;
    
    bool empty() const { return !has_value && children.size() == 0; }
    
    StringTrie<Value>() : has_value(false), total_nodes(1) {}
    
    void copy_char_trie(const UnicodeTrie<Value> &char_trie) {
        value = char_trie.value;
        has_value = char_trie.has_value;
        add_children(char_trie);
    }
    
    void write_json(JsonWriter &json) const {
        json.begin('{');
        
        if (children.size() > 0) {
            json.key("c");
            json.begin('{');
            
            for(StringTrie<Value>::const_iterator c = children.begin(); 
                c != children.end();
                ++c)
            {
                json.key(c->first);
                c->second.write_json(json);
            }
            json.end('}');
        }
        
        if (has_value) {
            json.key("v").value(value);
        }
        json.end('}');
    }
    
private:

    void add_children(const UnicodeTrie<Value> &char_trie) {
        for (typename UnicodeTrie<Value>::const_iterator itr = char_trie.children.begin();
            itr != char_trie.children.end(); ++itr) {
            
            std::ostringstream edge;
            children.push_back(KeyValuePair("", StringTrie<Value>()));
            edge << itr->first;
            add_child(itr->second, children.back(), edge);
            total_nodes += children.back().second.total_nodes;
        }
    }

    void add_child(const UnicodeTrie<Value> &child, KeyValuePair& kv_pair, std::ostringstream &edge) {
        if (child.children.size() == 1 && !child.has_value) {
            edge <<  child.children.begin()->first;
            add_child(child.children.begin()->second, kv_pair, edge);
        }
        else {
            kv_pair.first = edge.str();
            kv_pair.second.copy_char_trie(child);
        }
    }
};

#endif
