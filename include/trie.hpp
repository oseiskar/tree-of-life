#include <iostream>
#include <string>
#include <map>
#include <list>
#include <stdexcept>
#include <fstream>

#include <json.hpp>

using std::string;

class CharTrie {
public:
    std::map<char, CharTrie> children;
    
    bool has_value;
    string value;

    typedef std::map<char, CharTrie>::const_iterator const_iterator;

    void insert(const char *key, string value, bool replace = false) {
        CharTrie &where = lookup_subtree(key);
        where.insert_subtree(key, value, replace);
    }
    
    const string *lookup(const char *key) {
        CharTrie &where = lookup_subtree(key);
        if (key[0] != '\0' || !where.has_value) return NULL;
        return &(where.value);
    }
    
    const string &get(const char *key) {
        const string *s = lookup(key);
        if (s == NULL) throw std::runtime_error("not found");
        return *s;
    }
    
    CharTrie() : has_value(false) {}
    
private:
    typedef std::map<char, CharTrie>::iterator iterator;

    CharTrie &lookup_subtree(const char *&key) {
        
        if (key[0] == '\0') return *this;
        iterator itr = children.find(key[0]);
        if (itr != children.end()) {
            key += 1;
            return itr->second.lookup_subtree(key);
        }
        return *this;
    }
    
    void insert_subtree(const char *key, const string &new_v, bool replace) {
        
        if (key[0] == '\0') {
            if (!replace && has_value)
                throw std::runtime_error("key already exists in trie");
            value = new_v;
            has_value = true;
            return;
        }
        
        children[key[0]] = CharTrie();
        children.find(key[0])->second.insert_subtree(key+1, new_v, replace);
    }
};

class StringTrie {
public:
    typedef std::pair<string, StringTrie> KeyValuePair;
    std::list<KeyValuePair> children;
    typedef std::list<KeyValuePair>::const_iterator const_iterator;
    
    string value;
    bool has_value;
    
    StringTrie() : has_value(false) {}
    
    void copy_char_trie(const CharTrie &char_trie) {
        value = char_trie.value;
        has_value = char_trie.has_value;
        add_children(char_trie);
    }
    
    void write_json(JsonWriter &json) const {
        json.begin('{');
        
        if (children.size() > 0) {
            json.key("c");
            json.begin('{');
            
            for(StringTrie::const_iterator c = children.begin(); 
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

    void add_children(const CharTrie &char_trie) {
        for (CharTrie::const_iterator itr = char_trie.children.begin();
            itr != char_trie.children.end(); ++itr) {
            
            std::ostringstream edge;
            children.push_back(KeyValuePair("", StringTrie()));
            edge << itr->first;
            add_child(itr->second, children.back(), edge);
        }
    }

    void add_child(const CharTrie &child, KeyValuePair& kv_pair, std::ostringstream &edge) {
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
